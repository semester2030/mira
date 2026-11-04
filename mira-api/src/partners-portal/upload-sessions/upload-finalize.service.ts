import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMediaStorage } from '../../marketplace/catalog-media.contract';
import { IMAGE_MIME, VIDEO_MIME, sniffMedia } from '../../marketplace/catalog-content.policy';
import { isoBmffDurationSeconds, videoDurationRejection } from '../../marketplace/catalog-video-duration';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';

@Injectable()
export class UploadFinalizeService {
  private readonly log = new Logger(UploadFinalizeService.name);
  private readonly queue = new Set<string>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MultipartUploadStore) private readonly multipart: MultipartUploadStore,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  enqueue(sessionId: string) {
    if (this.queue.has(sessionId) || this.running.has(sessionId)) return;
    this.queue.add(sessionId);
    setImmediate(() => {
      void this.drain();
    });
  }

  private async drain() {
    for (const sessionId of [...this.queue]) {
      this.queue.delete(sessionId);
      try {
        await this.finalizeOne(sessionId);
      } catch (error) {
        this.log.error('finalize-unhandled', error as Error);
      }
    }
  }

  /** Exposed for tests to await finalize synchronously. Concurrent callers await the same work. */
  async finalizeOne(sessionId: string): Promise<void> {
    const existing = this.running.get(sessionId);
    if (existing) {
      await existing;
      return;
    }
    const work = this.runFinalize(sessionId).finally(() => {
      this.running.delete(sessionId);
    });
    this.running.set(sessionId, work);
    await work;
  }

  private async runFinalize(sessionId: string): Promise<void> {
    const row = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!row) return;
    if (row.status === 'ready' && row.catalogMediaId) return;
    if (row.status === 'aborted') return;
    if (row.status !== 'uploaded' && row.status !== 'verifying') return;

    const claimed = await this.prisma.partnerUploadSession.updateMany({
      where: { id: sessionId, status: { in: ['uploaded', 'verifying'] }, catalogMediaId: null },
      data: {
        status: 'verifying',
        finalizeAttempts: { increment: 1 },
      },
    });
    if (!claimed.count) {
      const latest = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (latest?.status === 'ready') return;
      if (latest?.status === 'aborted') return;
      return;
    }

    let cleanup: (() => Promise<void>) | null = null;
    try {
      const head = await this.multipart.head(row.objectKey);
      if (!head || head.contentLength !== row.declaredByteSize) {
        await this.fail(sessionId, 'size_mismatch', 'حجم الملف المخزّن لا يطابق الحجم المعلن');
        return;
      }

      const materialized = await this.multipart.materializeToTemp(row.objectKey);
      cleanup = materialized.cleanup;
      const bytes = await readFile(materialized.filePath);

      // Peak buffer is one object for verification; streaming materialize keeps S3 path off the Nest request stack.
      if (bytes.length !== row.declaredByteSize) {
        await this.fail(sessionId, 'size_mismatch', 'حجم الملف بعد القراءة لا يطابق الحجم المعلن');
        return;
      }

      const mime = row.declaredMimeType;
      if (!sniffMedia(mime, bytes)) {
        await this.fail(sessionId, 'content_mismatch', 'محتوى الملف لا يطابق نوعه المعلن');
        return;
      }
      if (row.declaredChecksum) {
        const actual = createHash('sha256').update(bytes).digest('hex');
        if (actual.toLowerCase() !== String(row.declaredChecksum).trim().toLowerCase()) {
          await this.fail(sessionId, 'content_mismatch', 'بصمة الملف لا تطابق المعلن عند بدء الجلسة');
          return;
        }
      }
      const image = IMAGE_MIME.has(mime);
      const video = VIDEO_MIME.has(mime);
      let duration: number | null = null;
      if (video) {
        const rejection = videoDurationRejection(bytes);
        if (rejection) {
          await this.fail(sessionId, 'duration_invalid', rejection);
          return;
        }
        duration = isoBmffDurationSeconds(bytes);
      }

      // Abort race: if aborted during verify before bind, stop without creating media
      const still = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (!still || still.status === 'aborted') {
        return;
      }

      const catalogKey = this.multipart instanceof MemoryMultipartUploadStore ? randomUUID() : row.objectKey;

      if (this.multipart instanceof MemoryMultipartUploadStore) {
        await this.multipart.copyToCatalogStorage(this.storage, row.objectKey, catalogKey);
      }

      const sourceMediaKey = `upload-session:${row.id}`;
      const media = await this.prisma.$transaction(async (tx) => {
        const session = await tx.partnerUploadSession.findUnique({ where: { id: sessionId } });
        if (!session || session.status === 'aborted') return null;
        if (session.catalogMediaId) {
          return tx.catalogMedia.findUnique({ where: { id: session.catalogMediaId } });
        }

        const owner =
          session.ownerKind === 'product'
            ? await tx.product.findFirst({ where: { id: session.ownerId, partnerId: session.partnerId } })
            : await tx.service.findFirst({ where: { id: session.ownerId, partnerId: session.partnerId } });
        if (!owner) {
          throw new Error('owner-missing');
        }

        const count = await tx.catalogMedia.count({
          where: { ownerKind: session.ownerKind, ownerId: session.ownerId },
        });
        const published = owner.contentStatus === 'published';
        const firstMedia = count === 0;
        const firstImage = firstMedia && image;
        const created = await tx.catalogMedia.upsert({
          where: {
            ownerKind_ownerId_sourceMediaKey: {
              ownerKind: session.ownerKind,
              ownerId: session.ownerId,
              sourceMediaKey,
            },
          },
          create: {
            ownerKind: session.ownerKind,
            ownerId: session.ownerId,
            sortOrder: count,
            draftSortOrder: published ? count : null,
            kind: image ? 'image' : 'video',
            url: '',
            active: false,
            mimeType: video ? 'video/mp4' : mime,
            byteSize: bytes.length,
            storageKey: catalogKey,
            isPrimary: published ? false : firstImage || (firstMedia && video),
            draftIsPrimary: firstImage || (firstMedia && video) ? true : null,
            publication: 'draft',
            placement: session.placement,
            sourceMediaKey,
          },
          update: {
            // Idempotent re-bind: keep existing storage/row; refresh verified size/mime only via session.
          },
        });
        await tx.partnerUploadSession.update({
          where: { id: sessionId },
          data: {
            status: 'ready',
            catalogMediaId: created.id,
            verifiedMimeType: video ? 'video/mp4' : mime,
            verifiedByteSize: bytes.length,
            verifiedDurationSec: duration,
            readyAt: new Date(),
            failureCode: null,
            failureMessageAr: null,
          },
        });
        return created;
      });

      if (!media) {
        // aborted during bind
        return;
      }
    } catch (error) {
      this.log.error(`finalize-failed ${sessionId}`, error as Error);
      await this.fail(sessionId, 'finalize_error', 'تعذر التحقق من الملف وربطه');
    } finally {
      if (cleanup) {
        try {
          await cleanup();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async fail(sessionId: string, code: string, messageAr: string) {
    await this.prisma.partnerUploadSession.updateMany({
      where: { id: sessionId, status: { in: ['uploaded', 'verifying'] }, catalogMediaId: null },
      data: {
        status: 'failed',
        failureCode: code,
        failureMessageAr: messageAr,
      },
    });
  }
}
