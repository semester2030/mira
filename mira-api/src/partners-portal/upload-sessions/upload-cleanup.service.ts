import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UPLOAD_SESSION_TTL_HOURS, uploadNowMs } from './upload-sessions.policy';
import { UploadFinalizeService } from './upload-finalize.service';

/**
 * Expires incomplete sessions after TTL (default 24h). Controllable via setUploadClock in tests.
 * Never deletes CatalogMedia-bound objects.
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
    // Light periodic sweep; also recoverable on demand.
    const intervalMs = Number(process.env.MIRA_UPLOAD_CLEANUP_INTERVAL_MS || String(15 * 60 * 1000));
    if (intervalMs > 0 && (process.env.NODE_ENV || '').toLowerCase() !== 'test') {
      setInterval(() => {
        void this.sweepExpired().catch((e) => this.log.error('cleanup-sweep-failed', e as Error));
        void this.finalize.recoverStaleWork().catch((e) => this.log.error('recover-failed', e as Error));
      }, intervalMs).unref?.();
    }
  }

  async sweepExpired(limit = 50): Promise<{ cleaned: number; skippedBound: number }> {
    const now = new Date(uploadNowMs());
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
    for (const row of rows) {
      if (row.catalogMediaId || row.status === 'ready') {
        skippedBound += 1;
        await this.prisma.partnerUploadSession.update({
          where: { id: row.id },
          data: { cleanedAt: now },
        });
        continue;
      }

      // Abort incomplete multipart if still open
      if (row.storageUploadId && !row.storageCompletedAt && row.status !== 'aborted') {
        try {
          await this.multipart.abort(row.objectKey, row.storageUploadId);
        } catch (error) {
          this.log.warn(`cleanup-abort-multipart ${row.id}: ${(error as Error).message}`);
        }
      }

      // Delete unbound completed object only when no CatalogMedia references the key
      if (row.storageCompletedAt || row.status === 'uploaded' || row.status === 'failed') {
        const media = await this.prisma.catalogMedia.findFirst({
          where: { storageKey: row.objectKey },
          select: { id: true },
        });
        if (!media && this.multipart instanceof MemoryMultipartUploadStore) {
          await this.multipart.deleteObject(row.objectKey);
        }
        // S3: delete only exact objectKey when unbound — left to ops for RC2 memory/S3 parity;
        // we never prefix-delete.
      }

      await this.prisma.partnerUploadSession.update({
        where: { id: row.id },
        data: {
          status: row.status === 'ready' ? row.status : 'aborted',
          abortedAt: row.abortedAt || now,
          cleanedAt: now,
          failureCode: row.failureCode || 'expired',
          failureMessageAr: row.failureMessageAr || 'انتهت صلاحية جلسة الرفع ونُظّفت',
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
        },
      });
      cleaned += 1;
    }
    return { cleaned, skippedBound };
  }
}
