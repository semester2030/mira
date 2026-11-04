import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMediaStorage } from '../../marketplace/catalog-media.contract';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { verifyMediaFile } from './upload-media-verify';
import {
  UPLOAD_FINALIZE_CONCURRENCY,
  UPLOAD_FINALIZE_LEASE_MS,
  UPLOAD_FINALIZE_MAX_ATTEMPTS,
  UPLOAD_IMAGE_MAX_BYTES,
  uploadNowMs,
} from './upload-sessions.policy';

@Injectable()
export class UploadFinalizeService implements OnModuleInit {
  private readonly log = new Logger(UploadFinalizeService.name);
  private readonly workerId = `finalize-${randomUUID()}`;
  private readonly inFlight = new Map<string, Promise<void>>();
  private activeCount = 0;
  private readonly waitQueue: string[] = [];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MultipartUploadStore) private readonly multipart: MultipartUploadStore,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  onModuleInit() {
    setImmediate(() => {
      void this.recoverStaleWork();
    });
  }

  enqueue(sessionId: string) {
    if (this.inFlight.has(sessionId) || this.waitQueue.includes(sessionId)) return;
    this.waitQueue.push(sessionId);
    setImmediate(() => void this.pump());
  }

  private async pump() {
    while (this.activeCount < UPLOAD_FINALIZE_CONCURRENCY && this.waitQueue.length) {
      const sessionId = this.waitQueue.shift()!;
      if (this.inFlight.has(sessionId)) continue;
      this.activeCount += 1;
      void this.finalizeOne(sessionId).finally(() => {
        this.activeCount -= 1;
        setImmediate(() => void this.pump());
      });
    }
  }

  /** Crash recovery: reclaim expired leases and retryable/uploaded sessions. */
  async recoverStaleWork(limit = 20): Promise<number> {
    const now = new Date(uploadNowMs());
    const rows = await this.prisma.partnerUploadSession.findMany({
      where: {
        catalogMediaId: null,
        OR: [
          { status: 'uploaded' },
          { status: 'verifying', OR: [{ finalizeLeaseUntil: null }, { finalizeLeaseUntil: { lt: now } }] },
          { status: 'failed', failureClass: 'retryable' },
          { status: 'uploading', storageCompletedAt: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const row of rows) this.enqueue(row.id);
    return rows.length;
  }

  async finalizeOne(sessionId: string): Promise<void> {
    const existing = this.inFlight.get(sessionId);
    if (existing) {
      await existing;
      return;
    }
    const work = this.runFinalize(sessionId).finally(() => {
      this.inFlight.delete(sessionId);
    });
    this.inFlight.set(sessionId, work);
    await work;
  }

  private async claimLease(sessionId: string): Promise<boolean> {
    const now = uploadNowMs();
    const until = new Date(now + UPLOAD_FINALIZE_LEASE_MS);
    // Claim uploaded / retryable-failed / verifying with expired lease / uploading with storage done
    const claimed = await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        catalogMediaId: null,
        OR: [
          { status: 'uploaded' },
          { status: 'failed', failureClass: 'retryable' },
          { status: 'uploading', storageCompletedAt: { not: null } },
          {
            status: 'verifying',
            OR: [{ finalizeLeaseUntil: null }, { finalizeLeaseUntil: { lt: new Date(now) } }],
          },
        ],
      },
      data: {
        status: 'verifying',
        finalizeLeaseOwner: this.workerId,
        finalizeLeaseUntil: until,
        finalizeAttempts: { increment: 1 },
        failureCode: null,
        failureMessageAr: null,
        failureClass: null,
      },
    });
    return claimed.count > 0;
  }

  private async runFinalize(sessionId: string): Promise<void> {
    const row = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!row) return;
    if (row.status === 'ready' && row.catalogMediaId) return;
    if (row.status === 'aborted') return;
    if (row.status === 'failed' && row.failureClass === 'permanent') return;

    if (!(await this.claimLease(sessionId))) {
      const latest = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (latest?.status === 'ready' || latest?.status === 'aborted') return;
      return;
    }

    const leased = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!leased || leased.status === 'aborted') return;
    if (leased.finalizeAttempts > UPLOAD_FINALIZE_MAX_ATTEMPTS) {
      await this.fail(sessionId, 'finalize_exhausted', 'تجاوزت محاولات التحقق الحد المسموح', 'permanent');
      return;
    }

    let cleanup: (() => Promise<void>) | null = null;
    try {
      let head;
      try {
        head = await this.multipart.head(leased.objectKey);
      } catch (error) {
        this.log.error(`finalize-head-error ${sessionId}`, error as Error);
        await this.fail(sessionId, 'storage_unavailable', 'تعذر الاتصال بالتخزين أثناء التحقق', 'retryable');
        return;
      }
      if (!head) {
        await this.fail(sessionId, 'object_missing', 'الكائن غير موجود في التخزين', 'retryable');
        return;
      }
      if (head.contentLength !== leased.declaredByteSize) {
        await this.fail(sessionId, 'size_mismatch', 'حجم الملف المخزّن لا يطابق الحجم المعلن', 'permanent');
        return;
      }

      const abortedEarly = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (!abortedEarly || abortedEarly.status === 'aborted') return;

      let materialized;
      try {
        materialized = await this.multipart.materializeToTemp(leased.objectKey);
      } catch (error) {
        this.log.error(`finalize-materialize-error ${sessionId}`, error as Error);
        await this.fail(sessionId, 'storage_unavailable', 'تعذر تنزيل الملف للتحقق', 'retryable');
        return;
      }
      cleanup = materialized.cleanup;

      const verified = await verifyMediaFile({
        filePath: materialized.filePath,
        mime: leased.declaredMimeType,
        declaredByteSize: leased.declaredByteSize,
        declaredChecksum: leased.declaredChecksum,
        imageMaxBytes: UPLOAD_IMAGE_MAX_BYTES,
      });
      if (!verified.ok) {
        await this.fail(sessionId, verified.code, verified.messageAr, verified.permanent ? 'permanent' : 'retryable');
        return;
      }

      const still = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (!still || still.status === 'aborted') return;
      // Ensure we still hold lease
      if (still.finalizeLeaseOwner !== this.workerId) return;

      const catalogKey = this.multipart instanceof MemoryMultipartUploadStore ? randomUUID() : leased.objectKey;
      if (this.multipart instanceof MemoryMultipartUploadStore) {
        await this.multipart.copyToCatalogStorage(this.storage, leased.objectKey, catalogKey);
      }

      const image = verified.kind === 'image';
      const video = verified.kind === 'video';
      const sourceMediaKey = `upload-session:${leased.id}`;

      const media = await this.prisma.$transaction(async (tx) => {
        const session = await tx.partnerUploadSession.findUnique({ where: { id: sessionId } });
        if (!session || session.status === 'aborted') return null;
        if (session.finalizeLeaseOwner !== this.workerId) return null;
        if (session.catalogMediaId) {
          return tx.catalogMedia.findUnique({ where: { id: session.catalogMediaId } });
        }

        const owner =
          session.ownerKind === 'product'
            ? await tx.product.findFirst({ where: { id: session.ownerId, partnerId: session.partnerId } })
            : await tx.service.findFirst({ where: { id: session.ownerId, partnerId: session.partnerId } });
        if (!owner) throw new Error('owner-missing');

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
            mimeType: video ? 'video/mp4' : leased.declaredMimeType,
            byteSize: verified.byteSize,
            storageKey: catalogKey,
            isPrimary: published ? false : firstImage || (firstMedia && video),
            draftIsPrimary: firstImage || (firstMedia && video) ? true : null,
            publication: 'draft',
            placement: session.placement,
            sourceMediaKey,
          },
          update: {},
        });

        const marked = await tx.partnerUploadSession.updateMany({
          where: {
            id: sessionId,
            status: 'verifying',
            catalogMediaId: null,
            finalizeLeaseOwner: this.workerId,
          },
          data: {
            status: 'ready',
            catalogMediaId: created.id,
            verifiedMimeType: video ? 'video/mp4' : leased.declaredMimeType,
            verifiedByteSize: verified.byteSize,
            verifiedDurationSec: verified.durationSec,
            verifiedChecksum: verified.sha256,
            readyAt: new Date(uploadNowMs()),
            failureCode: null,
            failureMessageAr: null,
            failureClass: null,
            finalizeLeaseOwner: null,
            finalizeLeaseUntil: null,
          },
        });
        if (!marked.count) return null;
        return created;
      });

      if (!media) return;
    } catch (error) {
      this.log.error(`finalize-failed ${sessionId}`, error as Error);
      await this.fail(sessionId, 'finalize_error', 'تعذر التحقق من الملف وربطه', 'retryable');
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

  private async fail(
    sessionId: string,
    code: string,
    messageAr: string,
    failureClass: 'permanent' | 'retryable',
  ) {
    await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        status: { in: ['uploaded', 'verifying', 'uploading', 'failed'] },
        catalogMediaId: null,
      },
      data: {
        status: 'failed',
        failureCode: code,
        failureMessageAr: messageAr,
        failureClass,
        finalizeLeaseOwner: null,
        finalizeLeaseUntil: null,
      },
    });
  }
}
