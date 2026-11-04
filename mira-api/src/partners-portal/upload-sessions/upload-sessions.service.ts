import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMediaStorage } from '../../marketplace/catalog-media.contract';
import {
  IMAGE_MIME,
  VIDEO_MIME,
  UPLOAD_FINALIZE_CONCURRENCY,
  UPLOAD_FINALIZE_MAX_ATTEMPTS,
  UPLOAD_IMAGE_MAX_BYTES,
  UPLOAD_PART_CONCURRENCY,
  UPLOAD_PART_MAX_RETRIES,
  UPLOAD_PART_SIZE_BYTES,
  UPLOAD_SESSION_TTL_HOURS,
  computeTotalParts,
  expectedPartSize,
  uploadDirectPartsAllowed,
  uploadNowMs,
  uploadSessionEnabled,
  uploadVideoMaxBytes,
} from './upload-sessions.policy';
import { CompletedPart, MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadFinalizeService } from './upload-finalize.service';

type OwnerKind = 'product' | 'service';

type PartRow = CompletedPart & { completedAt?: string };

function asParts(json: unknown): PartRow[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const partNumber = Number(r.partNumber);
      const size = Number(r.size);
      const etag = String(r.etag || '');
      if (!Number.isInteger(partNumber) || partNumber < 1 || !etag || !Number.isFinite(size) || size < 0) return null;
      return { partNumber, etag, size, completedAt: r.completedAt ? String(r.completedAt) : undefined };
    })
    .filter(Boolean) as PartRow[];
}

@Injectable()
export class UploadSessionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MultipartUploadStore) private readonly multipart: MultipartUploadStore,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
    @Inject(UploadFinalizeService) private readonly finalize: UploadFinalizeService,
  ) {}

  /** Only blocks *new* sessions. Existing session ops stay available for rollback. */
  assertNewSessionsEnabled() {
    if (!uploadSessionEnabled()) {
      throw new ServiceUnavailableException('رفع الجلسات غير مفعّل على هذه البيئة');
    }
  }

  policy() {
    return {
      enabled: uploadSessionEnabled(),
      partSizeBytes: UPLOAD_PART_SIZE_BYTES,
      concurrency: UPLOAD_PART_CONCURRENCY,
      partMaxRetries: UPLOAD_PART_MAX_RETRIES,
      imageMaxBytes: UPLOAD_IMAGE_MAX_BYTES,
      videoMaxBytes: uploadVideoMaxBytes(),
      videoMaxDurationSec: 300,
      sessionTtlHours: UPLOAD_SESSION_TTL_HOURS,
      finalizeConcurrency: UPLOAD_FINALIZE_CONCURRENCY,
      finalizeMaxAttempts: UPLOAD_FINALIZE_MAX_ATTEMPTS,
      allowedImageMime: [...IMAGE_MIME],
      allowedVideoMime: [...VIDEO_MIME],
      storeMode: this.multipart instanceof MemoryMultipartUploadStore ? 'memory' : 's3',
      directPartsAllowed: uploadDirectPartsAllowed() && this.multipart instanceof MemoryMultipartUploadStore,
    };
  }

  private async assertOwner(partnerId: string, ownerKind: OwnerKind, ownerId: string) {
    if (ownerKind === 'product') {
      const row = await this.prisma.product.findFirst({ where: { id: ownerId, partnerId }, select: { id: true } });
      if (!row) throw new NotFoundException('العنصر غير موجود');
      return;
    }
    if (ownerKind === 'service') {
      const row = await this.prisma.service.findFirst({ where: { id: ownerId, partnerId }, select: { id: true } });
      if (!row) throw new NotFoundException('العنصر غير موجود');
      return;
    }
    throw new BadRequestException('نوع العنصر غير مدعوم');
  }

  private publicSession(row: {
    id: string;
    status: string;
    ownerKind: string;
    ownerId: string;
    clientMediaId: string;
    declaredMimeType: string;
    declaredByteSize: number;
    declaredChecksum: string | null;
    objectKey: string;
    partSizeBytes: number;
    totalParts: number;
    completedPartsJson: unknown;
    catalogMediaId: string | null;
    failureMessageAr: string | null;
    failureCode: string | null;
    failureClass: string | null;
    expiresAt: Date;
    readyAt: Date | null;
    verifiedByteSize: number | null;
    verifiedMimeType: string | null;
    storageCompletedAt: Date | null;
    finalizeAttempts: number;
  }) {
    const parts = asParts(row.completedPartsJson);
    const uploadedBytes = parts.reduce((sum, p) => sum + p.size, 0);
    return {
      sessionId: row.id,
      status: row.status,
      ownerKind: row.ownerKind,
      ownerId: row.ownerId,
      clientMediaId: row.clientMediaId,
      declaredMimeType: row.declaredMimeType,
      declaredByteSize: row.declaredByteSize,
      declaredChecksum: row.declaredChecksum,
      partSizeBytes: row.partSizeBytes,
      totalParts: row.totalParts,
      completedParts: parts.map((p) => ({ partNumber: p.partNumber, size: p.size, etag: p.etag })),
      uploadedBytes,
      catalogMediaId: row.catalogMediaId,
      failureMessageAr: row.failureMessageAr,
      failureCode: row.failureCode,
      failureClass: row.failureClass,
      retryable: row.failureClass === 'retryable',
      expiresAt: row.expiresAt.toISOString(),
      readyAt: row.readyAt ? row.readyAt.toISOString() : null,
      verifiedByteSize: row.verifiedByteSize,
      verifiedMimeType: row.verifiedMimeType,
      storageCompleted: !!row.storageCompletedAt,
      finalizeAttempts: row.finalizeAttempts,
      objectKeyFingerprint: createHash('sha256').update(row.objectKey).digest('hex').slice(0, 16),
      upload: {
        partSizeBytes: row.partSizeBytes,
        totalParts: row.totalParts,
        concurrency: UPLOAD_PART_CONCURRENCY,
        partMaxRetries: UPLOAD_PART_MAX_RETRIES,
      },
    };
  }

  async initiate(
    partnerId: string,
    input: {
      ownerKind: OwnerKind;
      ownerId: string;
      clientMediaId: string;
      idempotencyKey: string;
      mimeType: string;
      byteSize: number;
      checksum?: string;
      placement?: string;
      clientDraftId?: string;
    },
  ) {
    this.assertNewSessionsEnabled();
    const ownerKind = input.ownerKind;
    if (ownerKind !== 'product' && ownerKind !== 'service') throw new BadRequestException('نوع العنصر غير مدعوم');
    if (!input.ownerId || !input.clientMediaId || !input.idempotencyKey) {
      throw new BadRequestException('بيانات الجلسة ناقصة');
    }
    await this.assertOwner(partnerId, ownerKind, input.ownerId);

    const mime = String(input.mimeType || '');
    const image = IMAGE_MIME.has(mime);
    const video = VIDEO_MIME.has(mime);
    if (!image && !video) throw new BadRequestException('نوع الملف غير مقبول');
    const byteSize = Number(input.byteSize);
    if (!Number.isInteger(byteSize) || byteSize <= 0) throw new BadRequestException('حجم الملف غير صالح');
    const max = image ? UPLOAD_IMAGE_MAX_BYTES : uploadVideoMaxBytes();
    if (byteSize > max) {
      throw new BadRequestException(image ? 'حجم الصورة يتجاوز 20 ميغابايت' : 'حجم الفيديو يتجاوز الحد المسموح');
    }

    const existing = await this.prisma.partnerUploadSession.findUnique({
      where: { partnerId_idempotencyKey: { partnerId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      if (
        existing.ownerKind !== ownerKind ||
        existing.ownerId !== input.ownerId ||
        existing.clientMediaId !== input.clientMediaId ||
        existing.declaredMimeType !== mime ||
        existing.declaredByteSize !== byteSize
      ) {
        throw new ConflictException('مفتاح العملية مستخدم ببيانات مختلفة');
      }
      return this.publicSession(existing);
    }

    const partSizeBytes = UPLOAD_PART_SIZE_BYTES;
    const totalParts = computeTotalParts(byteSize, partSizeBytes);
    if (totalParts < 1 || totalParts > 10000) throw new BadRequestException('عدد الأجزاء غير صالح');

    const objectKey = `upload/${partnerId}/${ownerKind}/${input.ownerId}/${randomUUID()}`;
    const placement = input.placement === 'detail' || input.placement === 'cover' ? input.placement : 'main';
    let storageUploadId: string;
    try {
      const created = await this.multipart.create(objectKey, mime);
      storageUploadId = created.storageUploadId;
    } catch (error) {
      console.error('upload-session-multipart-create-failed', error);
      throw new ServiceUnavailableException('تعذر بدء رفع التخزين');
    }

    const expiresAt = new Date(uploadNowMs() + UPLOAD_SESSION_TTL_HOURS * 3600 * 1000);
    try {
      const row = await this.prisma.partnerUploadSession.create({
        data: {
          partnerId,
          ownerKind,
          ownerId: input.ownerId,
          clientDraftId: input.clientDraftId || null,
          clientMediaId: input.clientMediaId,
          idempotencyKey: input.idempotencyKey,
          status: 'created',
          declaredMimeType: mime,
          declaredByteSize: byteSize,
          declaredChecksum: input.checksum || null,
          objectKey,
          storageUploadId,
          completedPartsJson: [],
          partSizeBytes,
          totalParts,
          placement,
          expiresAt,
        },
      });
      return this.publicSession(row);
    } catch (error) {
      try {
        await this.multipart.abort(objectKey, storageUploadId);
      } catch {
        /* ignore */
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.prisma.partnerUploadSession.findUnique({
          where: { partnerId_idempotencyKey: { partnerId, idempotencyKey: input.idempotencyKey } },
        });
        if (again) return this.publicSession(again);
      }
      throw error;
    }
  }

  private async loadOwned(partnerId: string, sessionId: string) {
    const row = await this.prisma.partnerUploadSession.findFirst({ where: { id: sessionId, partnerId } });
    if (!row) throw new NotFoundException('جلسة الرفع غير موجودة');
    return row;
  }

  /** Refresh completedParts from storage listParts and persist. */
  private async syncPartsFromStorage(row: {
    id: string;
    objectKey: string;
    storageUploadId: string | null;
    partSizeBytes: number;
    declaredByteSize: number;
    completedPartsJson: unknown;
    storageCompletedAt: Date | null;
  }) {
    if (!row.storageUploadId || row.storageCompletedAt) {
      return asParts(row.completedPartsJson);
    }
    try {
      const listed = await this.multipart.listParts(row.objectKey, row.storageUploadId);
      if (!listed.length) return asParts(row.completedPartsJson);
      const validated: PartRow[] = [];
      for (const p of listed) {
        const expect = expectedPartSize(row.declaredByteSize, p.partNumber, row.partSizeBytes);
        if (expect > 0 && p.size !== expect) continue;
        validated.push({
          partNumber: p.partNumber,
          etag: p.etag,
          size: p.size,
          completedAt: new Date(uploadNowMs()).toISOString(),
        });
      }
      validated.sort((a, b) => a.partNumber - b.partNumber);
      // Never revive aborted/ready/failed sessions via part sync.
      await this.prisma.partnerUploadSession.updateMany({
        where: { id: row.id, status: { in: ['created', 'uploading'] } },
        data: {
          completedPartsJson: validated as unknown as Prisma.InputJsonValue,
          ...(validated.length ? { status: 'uploading' } : {}),
        },
      });
      return validated;
    } catch (error) {
      console.error('upload-session-list-parts-failed', error);
      return asParts(row.completedPartsJson);
    }
  }

  async get(partnerId: string, sessionId: string) {
    let row = await this.loadOwned(partnerId, sessionId);
    // Recovery: storage completed but DB stuck in uploading
    if (row.status === 'uploading' && !row.storageCompletedAt) {
      try {
        const head = await this.multipart.head(row.objectKey);
        if (head && head.contentLength === row.declaredByteSize) {
          await this.prisma.partnerUploadSession.updateMany({
            where: { id: row.id, status: 'uploading', catalogMediaId: null },
            data: {
              status: 'uploaded',
              storageCompletedAt: new Date(uploadNowMs()),
              completedAt: new Date(uploadNowMs()),
            },
          });
          this.finalize.enqueue(row.id);
          row = await this.loadOwned(partnerId, sessionId);
        }
      } catch {
        /* leave as-is; transient */
      }
    }
    if (row.status === 'created' || row.status === 'uploading') {
      await this.syncPartsFromStorage(row);
      row = await this.loadOwned(partnerId, sessionId);
    }
    if ((row.status === 'uploaded' || (row.status === 'failed' && row.failureClass === 'retryable')) && !row.catalogMediaId) {
      this.finalize.enqueue(row.id);
    }
    return this.publicSession(row);
  }

  async signPart(partnerId: string, sessionId: string, partNumber: number) {
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'aborted' || row.status === 'ready') {
      throw new ConflictException('لا يمكن توقيع جزء لهذه الحالة');
    }
    if (row.status === 'failed' && row.failureClass === 'permanent') {
      throw new ConflictException('جلسة الرفع في حالة فشل نهائي');
    }
    if (row.status === 'uploaded' || row.status === 'verifying' || row.storageCompletedAt) {
      throw new ConflictException('اكتمل رفع التخزين؛ بانتظار التحقق');
    }
    if (row.expiresAt.getTime() < uploadNowMs()) throw new ConflictException('انتهت صلاحية جلسة الرفع');
    const n = Number(partNumber);
    if (!Number.isInteger(n) || n < 1 || n > row.totalParts) throw new BadRequestException('رقم الجزء غير صالح');
    const expect = expectedPartSize(row.declaredByteSize, n, row.partSizeBytes);
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');

    if (row.status === 'created') {
      await this.prisma.partnerUploadSession.updateMany({
        where: { id: row.id, status: 'created' },
        data: { status: 'uploading' },
      });
    }

    try {
      const signed = await this.multipart.signPart(row.objectKey, row.storageUploadId, n, row.id);
      return {
        sessionId: row.id,
        partNumber: n,
        expectedSize: expect,
        ...signed,
      };
    } catch (error) {
      console.error('upload-session-sign-failed', error);
      throw new ServiceUnavailableException('تعذر توقيع جزء الرفع');
    }
  }

  async recordDirectPart(partnerId: string, sessionId: string, partNumber: number, body: Buffer) {
    if (!uploadDirectPartsAllowed() || !(this.multipart instanceof MemoryMultipartUploadStore)) {
      throw new ForbiddenException('الرفع المباشر عبر API غير متاح');
    }
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'aborted' || row.status === 'ready' || row.storageCompletedAt) {
      throw new ConflictException('لا يمكن رفع جزء لهذه الحالة');
    }
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');
    const n = Number(partNumber);
    const expect = expectedPartSize(row.declaredByteSize, n, row.partSizeBytes);
    if (body.length !== expect) throw new BadRequestException('حجم الجزء لا يطابق المتوقع');
    const result = await this.multipart.putPartDirect(sessionId, row.objectKey, row.storageUploadId, n, body);
    const listed = await this.multipart.listParts(row.objectKey, row.storageUploadId);
    await this.prisma.partnerUploadSession.updateMany({
      where: { id: row.id, status: { in: ['created', 'uploading'] } },
      data: {
        status: 'uploading',
        completedPartsJson: listed.map((p) => ({
          ...p,
          completedAt: new Date(uploadNowMs()).toISOString(),
        })) as unknown as Prisma.InputJsonValue,
      },
    });
    return { partNumber: n, etag: result.etag, size: result.size };
  }

  async complete(
    partnerId: string,
    sessionId: string,
    input: { parts?: Array<{ partNumber: number; etag: string; size: number }> },
  ) {
    let row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'ready' && row.catalogMediaId) return this.publicSession(row);
    if (row.status === 'aborted') throw new ConflictException('أُلغيت جلسة الرفع');
    if (row.status === 'failed' && row.failureClass === 'permanent') {
      throw new ConflictException('جلسة الرفع في حالة فشل نهائي');
    }
    if (row.status === 'failed' && row.failureClass === 'retryable') {
      this.finalize.enqueue(row.id);
      return this.publicSession(row);
    }
    if (row.status === 'verifying' || row.status === 'uploaded' || row.storageCompletedAt) {
      this.finalize.enqueue(row.id);
      return this.publicSession(await this.loadOwned(partnerId, sessionId));
    }
    if (row.expiresAt.getTime() < uploadNowMs()) throw new ConflictException('انتهت صلاحية جلسة الرفع');
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');

    // Prefer storage-authoritative part list
    const listed = await this.syncPartsFromStorage(row);
    row = await this.loadOwned(partnerId, sessionId);
    const incoming = Array.isArray(input.parts) && input.parts.length ? input.parts : listed;
    if (incoming.length !== row.totalParts) throw new BadRequestException('قائمة الأجزاء غير مكتملة');

    const byNum = new Map<number, CompletedPart>();
    for (const raw of incoming) {
      const partNumber = Number(raw.partNumber);
      const size = Number(raw.size);
      const etag = String(raw.etag || '').trim();
      if (!Number.isInteger(partNumber) || !etag || !Number.isInteger(size) || size < 0) {
        throw new BadRequestException('بيانات جزء غير صالحة');
      }
      const expect = expectedPartSize(row.declaredByteSize, partNumber, row.partSizeBytes);
      if (size !== expect) throw new BadRequestException('حجم الجزء لا يطابق المتوقع');
      if (byNum.has(partNumber)) throw new BadRequestException('تكرار رقم جزء');
      byNum.set(partNumber, { partNumber, etag, size });
    }
    for (let i = 1; i <= row.totalParts; i++) {
      if (!byNum.has(i)) throw new BadRequestException('جزء مفقود: ' + i);
    }
    // When storage listed parts, require etag match
    if (listed.length === row.totalParts) {
      for (const p of listed) {
        const c = byNum.get(p.partNumber);
        if (!c || c.etag !== p.etag || c.size !== p.size) {
          throw new BadRequestException('تعارض بين قائمة العميل والتخزين');
        }
      }
    }
    const parts = [...byNum.values()].sort((a, b) => a.partNumber - b.partNumber);
    const sum = parts.reduce((s, p) => s + p.size, 0);
    if (sum !== row.declaredByteSize) throw new BadRequestException('مجموع أحجام الأجزاء لا يطابق الحجم المعلن');

    // Serialize against abort with row lock. Storage complete happens after lock confirms still active.
    const locked = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; catalog_media_id: string | null }>>`
        SELECT id, status, catalog_media_id
        FROM partner_upload_sessions
        WHERE id = ${row.id} AND partner_id = ${partnerId}
        FOR UPDATE
      `;
      const lockedRow = rows[0];
      if (!lockedRow) throw new NotFoundException('جلسة الرفع غير موجودة');
      if (lockedRow.status === 'aborted') throw new ConflictException('أُلغيت جلسة الرفع');
      if (lockedRow.status === 'ready' && lockedRow.catalog_media_id) {
        return { kind: 'ready' as const };
      }
      if (lockedRow.status === 'uploaded' || lockedRow.status === 'verifying') {
        return { kind: 'already' as const };
      }
      if (lockedRow.status !== 'created' && lockedRow.status !== 'uploading') {
        throw new ConflictException('تعذر إكمال الرفع لهذه الحالة');
      }
      await tx.partnerUploadSession.update({
        where: { id: row.id },
        data: {
          // Claim in-progress completion under lock so concurrent abort waits then sees this or we see abort.
          completedPartsJson: parts.map((p) => ({
            ...p,
            completedAt: new Date(uploadNowMs()).toISOString(),
          })) as unknown as Prisma.InputJsonValue,
        },
      });
      return { kind: 'proceed' as const };
    });

    if (locked.kind === 'ready' || locked.kind === 'already') {
      const latest = await this.loadOwned(partnerId, sessionId);
      if (latest.status === 'uploaded' || latest.status === 'verifying' || latest.storageCompletedAt) {
        this.finalize.enqueue(latest.id);
      }
      return this.publicSession(latest);
    }

    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');
    try {
      await this.multipart.complete(row.objectKey, row.storageUploadId, parts);
    } catch (error) {
      const latestAfter = await this.loadOwned(partnerId, sessionId);
      if (latestAfter.status === 'aborted') {
        // Abort won while storage complete was in flight — do not promote.
        return this.publicSession(latestAfter);
      }
      try {
        const head = await this.multipart.head(row.objectKey);
        if (!head || head.contentLength !== row.declaredByteSize) {
          console.error('upload-session-complete-storage-failed', error);
          throw new ServiceUnavailableException('تعذر إكمال الرفع في التخزين');
        }
      } catch (headErr) {
        if (headErr instanceof ServiceUnavailableException) throw headErr;
        const again = await this.loadOwned(partnerId, sessionId);
        if (again.status === 'aborted') return this.publicSession(again);
        console.error('upload-session-complete-storage-failed', error);
        throw new ServiceUnavailableException('تعذر إكمال الرفع في التخزين');
      }
    }

    // Second locked write: mark uploaded only if still not aborted
    const finalRow = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; catalog_media_id: string | null }>>`
        SELECT id, status, catalog_media_id
        FROM partner_upload_sessions
        WHERE id = ${row.id} AND partner_id = ${partnerId}
        FOR UPDATE
      `;
      const lockedRow = rows[0];
      if (!lockedRow) throw new NotFoundException('جلسة الرفع غير موجودة');
      if (lockedRow.status === 'aborted') {
        return tx.partnerUploadSession.findUniqueOrThrow({ where: { id: row.id } });
      }
      if (lockedRow.status === 'ready' && lockedRow.catalog_media_id) {
        return tx.partnerUploadSession.findUniqueOrThrow({ where: { id: row.id } });
      }
      if (lockedRow.status === 'uploaded' || lockedRow.status === 'verifying') {
        return tx.partnerUploadSession.findUniqueOrThrow({ where: { id: row.id } });
      }
      return tx.partnerUploadSession.update({
        where: { id: row.id },
        data: {
          status: 'uploaded',
          completedAt: new Date(uploadNowMs()),
          storageCompletedAt: new Date(uploadNowMs()),
          completedPartsJson: parts.map((p) => ({
            ...p,
            completedAt: new Date(uploadNowMs()).toISOString(),
          })) as unknown as Prisma.InputJsonValue,
          failureCode: null,
          failureMessageAr: null,
          failureClass: null,
        },
      });
    });

    if (finalRow.status === 'uploaded' || finalRow.status === 'verifying') {
      this.finalize.enqueue(finalRow.id);
    }
    // Never enqueue finalize when aborted, even if storage object exists.
    return this.publicSession(finalRow);
  }

  async retryFinalize(partnerId: string, sessionId: string) {
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'ready' && row.catalogMediaId) return this.publicSession(row);
    if (row.status === 'aborted') throw new ConflictException('أُلغيت جلسة الرفع');
    if (row.status === 'failed' && row.failureClass !== 'retryable') {
      throw new ConflictException('الفشل غير قابل لإعادة المحاولة');
    }
    if (
      row.status !== 'uploaded' &&
      row.status !== 'verifying' &&
      !(row.status === 'failed' && row.failureClass === 'retryable') &&
      !(row.status === 'uploading' && row.storageCompletedAt)
    ) {
      throw new ConflictException('لا يمكن إعادة التحقق لهذه الحالة');
    }
    this.finalize.enqueue(row.id);
    await this.finalize.finalizeOne(row.id);
    return this.publicSession(await this.loadOwned(partnerId, sessionId));
  }

  async abort(partnerId: string, sessionId: string) {
    const latest = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          catalog_media_id: string | null;
          storage_upload_id: string | null;
          storage_completed_at: Date | null;
          object_key: string;
        }>
      >`
        SELECT id, status, catalog_media_id, storage_upload_id, storage_completed_at, object_key
        FROM partner_upload_sessions
        WHERE id = ${sessionId} AND partner_id = ${partnerId}
        FOR UPDATE
      `;
      const locked = rows[0];
      if (!locked) throw new NotFoundException('جلسة الرفع غير موجودة');
      if (locked.status === 'ready' && locked.catalog_media_id) {
        return tx.partnerUploadSession.findUniqueOrThrow({ where: { id: sessionId } });
      }
      if (locked.status === 'aborted') {
        return tx.partnerUploadSession.findUniqueOrThrow({ where: { id: sessionId } });
      }
      return tx.partnerUploadSession.update({
        where: { id: sessionId },
        data: {
          status: 'aborted',
          abortedAt: new Date(uploadNowMs()),
          failureCode: 'aborted',
          failureMessageAr: 'أُلغي الرفع',
          failureClass: 'permanent',
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
        },
      });
    });

    if (
      latest.storageUploadId &&
      !latest.storageCompletedAt &&
      latest.status === 'aborted'
    ) {
      try {
        await this.multipart.abort(latest.objectKey, latest.storageUploadId);
      } catch (error) {
        console.error('upload-session-abort-storage-failed', error);
      }
    }
    return this.publicSession(latest);
  }

  getMultipartStore(): MultipartUploadStore {
    return this.multipart;
  }

  getCatalogStorage(): CatalogMediaStorage {
    return this.storage;
  }
}
