import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MultipartUploadStore } from './multipart.store';
import { uploadNowMs } from './upload-sessions.policy';
import { UploadFinalizeService } from './upload-finalize.service';

function isBenignAbortError(error: unknown): boolean {
  const name = String((error as { name?: string; Code?: string })?.name || (error as { Code?: string })?.Code || '');
  const msg = String((error as Error)?.message || error).toLowerCase();
  return (
    name === 'NoSuchUpload' ||
    name === 'NotFound' ||
    msg.includes('nosuchupload') ||
    msg.includes('upload-not-found') ||
    msg.includes('not found')
  );
}

/**
 * Expires incomplete sessions after TTL. Never marks cleanedAt unless storage work succeeded.
 * F02: abort connection failures and missing completed-object deletes block cleanedAt.
 * F03: claim aborted under FOR UPDATE before delete; respect active finalize lease.
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

  async cleanOne(sessionId: string, nowMs = uploadNowMs()): Promise<'cleaned' | 'bound' | 'lease' | 'skipped' | 'failed'> {
    const now = new Date(nowMs);

    type Locked = {
      id: string;
      status: string;
      catalog_media_id: string | null;
      storage_upload_id: string | null;
      storage_completed_at: Date | null;
      complete_intent_at: Date | null;
      object_key: string;
      finalize_lease_owner: string | null;
      finalize_lease_until: Date | null;
      cleaned_at: Date | null;
      expires_at: Date;
      declared_byte_size: number;
    };

    const claim = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Locked[]>`
        SELECT id, status, catalog_media_id, storage_upload_id, storage_completed_at, complete_intent_at,
               object_key, finalize_lease_owner, finalize_lease_until, cleaned_at, expires_at, declared_byte_size
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
            finalizeNextAttemptAt: null,
            completeIntentAt: null,
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
        completeIntentAt: live.complete_intent_at,
        declaredByteSize: live.declared_byte_size,
        // Abort open multipart when upload id still present and we have not recorded storage complete.
        needAbortMultipart: !!(live.storage_upload_id && !live.storage_completed_at),
      };
    });

    if (claim.kind !== 'claimed') return claim.kind;

    // Probe storage — do not trust storageCompletedAt alone (U10 / F02).
    let objectPresent = false;
    try {
      const head = await this.multipart.head(claim.objectKey);
      objectPresent = !!(head && head.contentLength > 0);
    } catch (error) {
      this.log.warn(`cleanup-head-failed ${sessionId}: ${(error as Error).message}`);
      await this.prisma.partnerUploadSession.updateMany({
        where: { id: sessionId, cleanedAt: null, status: 'aborted' },
        data: {
          failureCode: 'cleanup_storage_unavailable',
          failureMessageAr: 'تعذر التحقق من كائن التخزين أثناء التنظيف',
        },
      });
      return 'failed';
    }

    if (claim.needAbortMultipart && claim.storageUploadId) {
      try {
        await this.multipart.abort(claim.objectKey, claim.storageUploadId);
      } catch (error) {
        if (!isBenignAbortError(error)) {
          this.log.warn(`cleanup-abort-multipart ${sessionId}: ${(error as Error).message}`);
          await this.prisma.partnerUploadSession.updateMany({
            where: { id: sessionId, cleanedAt: null, status: 'aborted' },
            data: {
              failureCode: 'cleanup_abort_failed',
              failureMessageAr: 'تعذر إلغاء الرفع المتعدد الأجزاء أثناء التنظيف',
            },
          });
          // F02: do NOT set cleanedAt when abort fails for non-benign reasons
          return 'failed';
        }
      }
    }

    // Delete completed (or possibly completed) object by exact key when unbound.
    const needDelete =
      objectPresent ||
      !!claim.storageCompletedAt ||
      !!claim.completeIntentAt;

    if (needDelete || objectPresent) {
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
      // Re-check session not rebound under finalize while we probed
      const live = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (live?.status === 'ready' || live?.catalogMediaId) return 'bound';

      if (objectPresent || claim.storageCompletedAt || claim.completeIntentAt) {
        try {
          await this.multipart.deleteObject(claim.objectKey);
        } catch (error) {
          this.log.warn(`cleanup-delete-object ${sessionId}: ${(error as Error).message}`);
          await this.prisma.partnerUploadSession.updateMany({
            where: { id: sessionId, cleanedAt: null, status: 'aborted' },
            data: {
              failureCode: 'cleanup_delete_failed',
              failureMessageAr: 'تعذر حذف كائن التخزين أثناء التنظيف',
            },
          });
          return 'failed';
        }
      }
    }

    const marked = await this.prisma.partnerUploadSession.updateMany({
      where: {
        id: sessionId,
        cleanedAt: null,
        status: 'aborted',
        catalogMediaId: null,
      },
      data: {
        cleanedAt: now,
        failureCode: 'expired',
        failureMessageAr: 'انتهت صلاحية جلسة الرفع ونُظّفت',
      },
    });
    if (!marked.count) {
      const again = await this.prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
      if (again?.status === 'ready' || again?.catalogMediaId) return 'bound';
      return again?.cleanedAt ? 'skipped' : 'failed';
    }
    return 'cleaned';
  }
}
