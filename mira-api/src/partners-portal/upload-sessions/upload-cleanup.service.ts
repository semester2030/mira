import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MultipartUploadStore } from './multipart.store';
import { uploadNowMs } from './upload-sessions.policy';
import { UploadFinalizeService } from './upload-finalize.service';

/**
 * Expires incomplete sessions after TTL (default 24h). Controllable via setUploadClock in tests.
 * Never deletes CatalogMedia-bound objects. Never marks cleanedAt unless cleanup succeeded.
 * F03: claim aborted under FOR UPDATE before any object delete so finalize cannot bind mid-delete.
 */
@Injectable()
export class UploadCleanupService implements OnModuleInit {
  private readonly log = new Logger(UploadCleanupService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MultipartUploadStore) private readonly multipart: MultipartUploadStore,
    @Inject(UploadFinalizeService) private readonly finalize: UploadFinalizeService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.MIRA_UPLOAD_CLEANUP_INTERVAL_MS || String(15 * 60 * 1000));
    if (intervalMs > 0 && (process.env.NODE_ENV || '').toLowerCase() !== 'test') {
      setInterval(() => {
        void this.sweepExpired().catch((e) => this.log.error('cleanup-sweep-failed', e as Error));
        void this.finalize.recoverStaleWork().catch((e) => this.log.error('recover-failed', e as Error));
      }, intervalMs).unref?.();
    }
  }

  async sweepExpired(limit = 50): Promise<{ cleaned: number; skippedBound: number; skippedLease: number; failed: number }> {
    const nowMs = uploadNowMs();
    const now = new Date(nowMs);
    const rows = await this.prisma.partnerUploadSession.findMany({
      where: {
        expiresAt: { lt: now },
        cleanedAt: null,
        status: { in: ['created', 'uploading', 'uploaded', 'verifying', 'failed', 'aborted'] },
      },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });

    let cleaned = 0;
    let skippedBound = 0;
    let skippedLease = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const result = await this.cleanOne(row.id, nowMs);
        if (result === 'cleaned') cleaned += 1;
        else if (result === 'bound') skippedBound += 1;
        else if (result === 'lease') skippedLease += 1;
        else if (result === 'failed') failed += 1;
      } catch (error) {
        failed += 1;
        this.log.warn(`cleanup-one-failed ${row.id}: ${(error as Error).message}`);
      }
    }
    return { cleaned, skippedBound, skippedLease, failed };
  }

  /**
   * Atomic cleanup of one session.
   * 1) Claim aborted (or bound) under FOR UPDATE — never overwrite ready; respect active lease.
   * 2) Outside lock: abort multipart / deleteObject by exact key only.
   * 3) Set cleanedAt only after required storage work succeeds.
   */
  async cleanOne(sessionId: string, nowMs = uploadNowMs()): Promise<'cleaned' | 'bound' | 'lease' | 'skipped' | 'failed'> {
    const now = new Date(nowMs);

    type Locked = {
      id: string;
      status: string;
      catalog_media_id: string | null;
      storage_upload_id: string | null;
      storage_completed_at: Date | null;
      object_key: string;
      finalize_lease_owner: string | null;
      finalize_lease_until: Date | null;
      cleaned_at: Date | null;
      expires_at: Date;
    };

    const claim = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Locked[]>`
        SELECT id, status, catalog_media_id, storage_upload_id, storage_completed_at,
               object_key, finalize_lease_owner, finalize_lease_until, cleaned_at, expires_at
        FROM partner_upload_sessions
        WHERE id = ${sessionId}
        FOR UPDATE
      `;
      const live = rows[0];
      if (!live) return { kind: 'skipped' as const };
      if (live.cleaned_at) return { kind: 'skipped' as const };
      if (live.expires_at.getTime() >= nowMs) return { kind: 'skipped' as const };

      if (live.status === 'ready' || live.catalog_media_id) {
        await tx.partnerUploadSession.update({
          where: { id: sessionId },
          data: { cleanedAt: now },
        });
        return { kind: 'bound' as const };
      }

      if (
        live.status === 'verifying' &&
        live.finalize_lease_owner &&
        live.finalize_lease_until &&
        live.finalize_lease_until.getTime() > nowMs
      ) {
        return { kind: 'lease' as const };
      }

      // Already aborted (e.g. user abort) — still need storage cleanup + cleanedAt
      if (live.status !== 'aborted') {
        const updated = await tx.partnerUploadSession.updateMany({
          where: {
            id: sessionId,
            cleanedAt: null,
            catalogMediaId: null,
            status: { in: ['created', 'uploading', 'uploaded', 'verifying', 'failed'] },
          },
          data: {
            status: 'aborted',
            abortedAt: now,
            failureCode: 'expired',
            failureMessageAr: 'انتهت صلاحية جلسة الرفع ونُظّفت',
            finalizeLeaseOwner: null,
            finalizeLeaseUntil: null,
          },
        });
        if (!updated.count) {
          const again = await tx.partnerUploadSession.findUnique({ where: { id: sessionId } });
          if (again?.status === 'ready' || again?.catalogMediaId) {
            await tx.partnerUploadSession.update({
              where: { id: sessionId },
              data: { cleanedAt: now },
            });
            return { kind: 'bound' as const };
          }
          return { kind: 'skipped' as const };
        }
      }

      return {
        kind: 'claimed' as const,
        objectKey: live.object_key,
        storageUploadId: live.storage_upload_id,
        storageCompletedAt: live.storage_completed_at,
        needAbortMultipart: !!(live.storage_upload_id && !live.storage_completed_at),
        needDeleteObject: !!(
          live.storage_completed_at ||
          live.status === 'uploaded' ||
          live.status === 'failed' ||
          live.status === 'verifying' ||
          live.status === 'aborted'
        ),
      };
    });

    if (claim.kind !== 'claimed') return claim.kind;

    if (claim.needAbortMultipart && claim.storageUploadId) {
      try {
        await this.multipart.abort(claim.objectKey, claim.storageUploadId);
      } catch (error) {
        this.log.warn(`cleanup-abort-multipart ${sessionId}: ${(error as Error).message}`);
      }
    }

    if (claim.needDeleteObject) {
      const media = await this.prisma.catalogMedia.findFirst({
        where: { storageKey: claim.objectKey },
        select: { id: true },
      });
      if (media) {
        await this.prisma.partnerUploadSession.updateMany({
          where: { id: sessionId, cleanedAt: null },
          data: { cleanedAt: now },
        });
        return 'bound';
      }
      try {
        await this.multipart.deleteObject(claim.objectKey);
      } catch (error) {
        this.log.warn(`cleanup-delete-object ${sessionId}: ${(error as Error).message}`);
        // F02: do NOT set cleanedAt on delete failure — retryable
        return 'failed';
      }
    }

    const marked = await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        cleanedAt: null,
        status: 'aborted',
        catalogMediaId: null,
      },
      data: { cleanedAt: now },
    });
    if (!marked.count) {
      const again = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (again?.status === 'ready' || again?.catalogMediaId) return 'bound';
      return again?.cleanedAt ? 'skipped' : 'failed';
    }
    return 'cleaned';
  }
}
