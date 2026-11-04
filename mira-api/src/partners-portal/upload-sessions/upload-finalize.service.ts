import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMediaStorage } from '../../marketplace/catalog-media.contract';
import { DiskMultipartUploadStore, MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { verifyMediaFile } from './upload-media-verify';
import {
  UPLOAD_FINALIZE_CONCURRENCY,
  UPLOAD_FINALIZE_LEASE_MS,
  UPLOAD_FINALIZE_MAX_ATTEMPTS,
  UPLOAD_IMAGE_MAX_BYTES,
  finalizeRetryDelayMs,
  uploadNowMs,
} from './upload-sessions.policy';

function needsLocalCatalogCopy(store: MultipartUploadStore): boolean {
  return store instanceof MemoryMultipartUploadStore || store instanceof DiskMultipartUploadStore;
}

@Injectable()
export class UploadFinalizeService implements OnModuleInit {
  private readonly log = new Logger(UploadFinalizeService.name);
  readonly workerId = `finalize-${randomUUID()}`;
  private readonly inFlight = new Map<string, Promise<void>>();
  private activeCount = 0;
  private readonly waitQueue: string[] = [];
  /** Test hook: count how many runFinalize bodies actually start verify work. */
  activeVerifyStarts = 0;
  peakConcurrentVerifies = 0;
  private currentVerifies = 0;
  /** Test hook: awaited inside bind transaction after FOR UPDATE, before CatalogMedia create. */
  beforeCatalogBind: (() => Promise<void>) | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MultipartUploadStore) private readonly multipart: MultipartUploadStore,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  onModuleInit() {
    setImmediate(() => {
      void this.recoverStaleWork().catch((e) => this.log.warn(`recover-on-boot-failed: ${(e as Error).message}`));
    });
  }

  /** Schedule through the concurrency-limited pump (all paths must use this). */
  enqueue(sessionId: string) {
    if (this.inFlight.has(sessionId) || this.waitQueue.includes(sessionId)) return;
    this.waitQueue.push(sessionId);
    setImmediate(() => void this.pump());
  }

  /**
   * Enqueue and await completion — still respects UPLOAD_FINALIZE_CONCURRENCY.
   * Never bypasses the pump (F05).
   */
  async enqueueAndWait(sessionId: string): Promise<void> {
    const existing = this.inFlight.get(sessionId);
    if (existing) {
      await existing;
      return;
    }
    let resolveWait!: () => void;
    const gate = new Promise<void>((r) => {
      resolveWait = r;
    });
    const prevFinally = () => resolveWait();
    this.enqueue(sessionId);
    // Wait until this session appears in-flight then completes, or is already done.
    const deadline = uploadNowMs() + 120_000;
    while (uploadNowMs() < deadline) {
      const inflight = this.inFlight.get(sessionId);
      if (inflight) {
        await inflight;
        return;
      }
      const row = await this.prisma.partnerUploadSession.findUnique({
        where: { id: sessionId },
        select: { status: true, catalogMediaId: true, failureClass: true },
      });
      if (!row) return;
      if (row.status === 'ready' && row.catalogMediaId) return;
      if (row.status === 'aborted') return;
      if (row.status === 'failed' && row.failureClass === 'permanent') return;
      // Still queued — yield
      await new Promise((r) => setTimeout(r, 20));
      void gate;
      void prevFinally;
    }
  }

  private async pump() {
    while (this.activeCount < UPLOAD_FINALIZE_CONCURRENCY && this.waitQueue.length) {
      const sessionId = this.waitQueue.shift()!;
      if (this.inFlight.has(sessionId)) continue;
      // Skip sessions still in backoff without consuming a worker slot.
      const row = await this.prisma.partnerUploadSession.findUnique({
        where: { id: sessionId },
        select: { finalizeNextAttemptAt: true, status: true, catalogMediaId: true },
      });
      if (!row || row.catalogMediaId || row.status === 'ready' || row.status === 'aborted') continue;
      if (row.finalizeNextAttemptAt && row.finalizeNextAttemptAt.getTime() > uploadNowMs()) {
        // Re-queue later via recover; do not burn attempts.
        continue;
      }
      this.activeCount += 1;
      const work = this.runFinalize(sessionId).finally(() => {
        this.inFlight.delete(sessionId);
        this.activeCount -= 1;
        setImmediate(() => void this.pump());
      });
      this.inFlight.set(sessionId, work);
      void work;
    }
  }

  /**
   * U10: without GET — detect storage-complete + lost DB update via completeIntentAt
   * and/or full completedParts + head(objectKey).
   */
  async reconcileOrphanCompletes(limit = 20): Promise<number> {
    const nowMs = uploadNowMs();
    const candidates = await this.prisma.partnerUploadSession.findMany({
      where: {
        catalogMediaId: null,
        cleanedAt: null,
        status: 'uploading',
        OR: [{ completeIntentAt: { not: null } }, { storageCompletedAt: { not: null } }],
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    // Also: uploading with all parts recorded but no intent (crash before intent write is rare;
    // still probe sessions whose completedPartsJson length matches totalParts and are aged).
    const aged = await this.prisma.partnerUploadSession.findMany({
      where: {
        catalogMediaId: null,
        cleanedAt: null,
        status: 'uploading',
        storageCompletedAt: null,
        completeIntentAt: null,
        updatedAt: { lt: new Date(nowMs - 5_000) },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const seen = new Set<string>();
    let fixed = 0;
    for (const row of [...candidates, ...aged]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const parts = Array.isArray(row.completedPartsJson) ? (row.completedPartsJson as unknown[]) : [];
      const allParts = parts.length >= row.totalParts || !!row.completeIntentAt || !!row.storageCompletedAt;
      if (!allParts) continue;
      try {
        const head = await this.multipart.head(row.objectKey);
        if (!head || head.contentLength !== row.declaredByteSize) continue;
        const updated = await this.prisma.partnerUploadSession.updateMany({
          where: {
            id: row.id,
            status: 'uploading',
            catalogMediaId: null,
            cleanedAt: null,
          },
          data: {
            status: 'uploaded',
            storageCompletedAt: new Date(nowMs),
            completedAt: new Date(nowMs),
            completeIntentAt: null,
          },
        });
        if (updated.count) {
          fixed += 1;
          this.enqueue(row.id);
        }
      } catch (error) {
        this.log.warn(`reconcile-orphan ${row.id}: ${(error as Error).message}`);
      }
    }
    return fixed;
  }

  /** Crash recovery: reconcile orphans, then reclaim due leases / retryable / uploaded. */
  async recoverStaleWork(limit = 20): Promise<number> {
    await this.reconcileOrphanCompletes(limit);
    const now = new Date(uploadNowMs());
    const rows = await this.prisma.partnerUploadSession.findMany({
      where: {
        catalogMediaId: null,
        cleanedAt: null,
        AND: [
          {
            OR: [
              { finalizeNextAttemptAt: null },
              { finalizeNextAttemptAt: { lte: now } },
            ],
          },
          {
            OR: [
              { status: 'uploaded' },
              { status: 'verifying', OR: [{ finalizeLeaseUntil: null }, { finalizeLeaseUntil: { lt: now } }] },
              { status: 'failed', failureClass: 'retryable' },
              { status: 'uploading', storageCompletedAt: { not: null } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const row of rows) this.enqueue(row.id);
    return rows.length;
  }

  /**
   * @deprecated Prefer enqueue / enqueueAndWait so concurrency is enforced.
   * Kept as alias that routes through the pump (F05).
   */
  async finalizeOne(sessionId: string): Promise<void> {
    await this.enqueueAndWait(sessionId);
  }

  private async claimLease(sessionId: string): Promise<boolean> {
    const now = uploadNowMs();
    const until = new Date(now + UPLOAD_FINALIZE_LEASE_MS);
    // F05: only claim when due (finalizeNextAttemptAt null or <= now). Attempt increments here only.
    const claimed = await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        catalogMediaId: null,
        cleanedAt: null,
        AND: [
          {
            OR: [{ finalizeNextAttemptAt: null }, { finalizeNextAttemptAt: { lte: new Date(now) } }],
          },
          {
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
        ],
      },
      data: {
        status: 'verifying',
        finalizeLeaseOwner: this.workerId,
        finalizeLeaseUntil: until,
        finalizeAttempts: { increment: 1 },
        finalizeNextAttemptAt: null,
        failureCode: null,
        failureMessageAr: null,
        failureClass: null,
      },
    });
    return claimed.count > 0;
  }

  /** Renew lease while still verifying under this worker. */
  private async renewLease(sessionId: string): Promise<boolean> {
    const until = new Date(uploadNowMs() + UPLOAD_FINALIZE_LEASE_MS);
    const renewed = await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        status: 'verifying',
        catalogMediaId: null,
        finalizeLeaseOwner: this.workerId,
      },
      data: { finalizeLeaseUntil: until },
    });
    return renewed.count > 0;
  }

  private async stillOwns(sessionId: string): Promise<boolean> {
    const row = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!row) return false;
    if (row.status === 'aborted' || row.status === 'ready') return false;
    if (row.finalizeLeaseOwner !== this.workerId) return false;
    if (row.cleanedAt) return false;
    return true;
  }

  private async runFinalize(sessionId: string): Promise<void> {
    const row = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!row) return;
    if (row.status === 'ready' && row.catalogMediaId) return;
    if (row.status === 'aborted') return;
    if (row.status === 'failed' && row.failureClass === 'permanent') return;
    if (row.cleanedAt) return;

    if (!(await this.claimLease(sessionId))) {
      return;
    }

    const leased = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
    if (!leased || leased.status === 'aborted' || leased.cleanedAt) return;
    if (leased.finalizeAttempts > UPLOAD_FINALIZE_MAX_ATTEMPTS) {
      await this.fail(sessionId, 'finalize_exhausted', 'تجاوزت محاولات التحقق الحد المسموح', 'permanent');
      return;
    }

    this.currentVerifies += 1;
    this.activeVerifyStarts += 1;
    this.peakConcurrentVerifies = Math.max(this.peakConcurrentVerifies, this.currentVerifies);

    let cleanup: (() => Promise<void>) | null = null;
    try {
      if (!(await this.renewLease(sessionId))) return;

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

      if (!(await this.stillOwns(sessionId))) return;

      let materialized;
      try {
        materialized = await this.multipart.materializeToTemp(leased.objectKey);
      } catch (error) {
        this.log.error(`finalize-materialize-error ${sessionId}`, error as Error);
        await this.fail(sessionId, 'storage_unavailable', 'تعذر تنزيل الملف للتحقق', 'retryable');
        return;
      }
      cleanup = materialized.cleanup;

      if (!(await this.renewLease(sessionId))) return;

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

      if (!(await this.stillOwns(sessionId))) return;

      const catalogKey = needsLocalCatalogCopy(this.multipart) ? randomUUID() : leased.objectKey;
      if (needsLocalCatalogCopy(this.multipart)) {
        const local = this.multipart as MemoryMultipartUploadStore | DiskMultipartUploadStore;
        await local.copyToCatalogStorage(this.storage, leased.objectKey, catalogKey);
      }

      const image = verified.kind === 'image';
      const video = verified.kind === 'video';
      const sourceMediaKey = `upload-session:${leased.id}`;

      // F04: bind under row lock; throw to rollback if lease/abort lost after create.
      await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            catalog_media_id: string | null;
            finalize_lease_owner: string | null;
            partner_id: string;
            owner_kind: string;
            owner_id: string;
            placement: string;
          }>
        >`
          SELECT id, status, catalog_media_id, finalize_lease_owner, partner_id, owner_kind, owner_id, placement
          FROM partner_upload_sessions
          WHERE id = ${sessionId}
          FOR UPDATE
        `;
        const session = locked[0];
        if (!session) throw new Error('session-missing');
        if (session.status === 'aborted' || session.status === 'ready') {
          // Lost race — do not create media
          return;
        }
        if (session.finalize_lease_owner !== this.workerId) {
          return;
        }
        if (session.catalog_media_id) {
          return;
        }

        if (this.beforeCatalogBind) {
          await this.beforeCatalogBind();
        }

        // Re-check after barrier — another worker may have aborted while we yielded.
        const recheck = await tx.$queryRaw<Array<{ status: string; finalize_lease_owner: string | null; catalog_media_id: string | null }>>`
          SELECT status, finalize_lease_owner, catalog_media_id
          FROM partner_upload_sessions
          WHERE id = ${sessionId}
          FOR UPDATE
        `;
        const live = recheck[0];
        if (!live || live.status === 'aborted' || live.status === 'ready' || live.catalog_media_id) {
          return;
        }
        if (live.finalize_lease_owner !== this.workerId) {
          return;
        }

        const owner =
          session.owner_kind === 'product'
            ? await tx.product.findFirst({ where: { id: session.owner_id, partnerId: session.partner_id } })
            : await tx.service.findFirst({ where: { id: session.owner_id, partnerId: session.partner_id } });
        if (!owner) throw new Error('owner-missing');

        const count = await tx.catalogMedia.count({
          where: { ownerKind: session.owner_kind, ownerId: session.owner_id },
        });
        const published = owner.contentStatus === 'published';
        const firstMedia = count === 0;
        const firstImage = firstMedia && image;

        let created = await tx.catalogMedia.findFirst({
          where: {
            ownerKind: session.owner_kind,
            ownerId: session.owner_id,
            sourceMediaKey,
          },
        });
        if (!created) {
          try {
            created = await tx.catalogMedia.create({
              data: {
                ownerKind: session.owner_kind,
                ownerId: session.owner_id,
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
            });
          } catch (error) {
            created = await tx.catalogMedia.findFirst({
              where: {
                ownerKind: session.owner_kind,
                ownerId: session.owner_id,
                sourceMediaKey,
              },
            });
            if (!created) throw error;
          }
        }

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
        if (!marked.count) {
          // Abort/cleanup won after lock check window — roll back any new media row.
          throw new Error('bind-lost-lease');
        }
      });
    } catch (error) {
      const msg = String((error as Error)?.message || error);
      if (msg === 'bind-lost-lease') {
        // Transaction rolled back; session may be aborted — do not mark failed over abort.
        const latest = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
        if (latest?.status === 'aborted' || latest?.status === 'ready') return;
        await this.fail(sessionId, 'finalize_error', 'تعذر التحقق من الملف وربطه', 'retryable');
        return;
      }
      this.log.error(`finalize-failed ${sessionId}`, error as Error);
      if (await this.stillOwns(sessionId)) {
        await this.fail(sessionId, 'finalize_error', 'تعذر التحقق من الملف وربطه', 'retryable');
      }
    } finally {
      this.currentVerifies = Math.max(0, this.currentVerifies - 1);
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
    const row = await this.prisma.partnerUploadSession.findUnique({
      where: { id: sessionId },
      select: { finalizeAttempts: true },
    });
    const attempts = row?.finalizeAttempts ?? 1;
    const nextAt =
      failureClass === 'retryable' && attempts < UPLOAD_FINALIZE_MAX_ATTEMPTS
        ? new Date(uploadNowMs() + finalizeRetryDelayMs(attempts))
        : null;
    const permanent =
      failureClass === 'permanent' ||
      (failureClass === 'retryable' && attempts >= UPLOAD_FINALIZE_MAX_ATTEMPTS);
    await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        status: { in: ['uploaded', 'verifying', 'uploading', 'failed'] },
        catalogMediaId: null,
        finalizeLeaseOwner: this.workerId,
      },
      data: {
        status: 'failed',
        failureCode: permanent && failureClass === 'retryable' ? 'finalize_exhausted' : code,
        failureMessageAr:
          permanent && failureClass === 'retryable'
            ? 'تجاوزت محاولات التحقق الحد المسموح'
            : messageAr,
        failureClass: permanent ? 'permanent' : 'retryable',
        finalizeLeaseOwner: null,
        finalizeLeaseUntil: null,
        finalizeNextAttemptAt: permanent ? null : nextAt,
      },
    });
  }
}
