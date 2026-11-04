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
  UPLOAD_IMAGE_MAX_BYTES,
  UPLOAD_PART_CONCURRENCY,
  UPLOAD_PART_MAX_RETRIES,
  UPLOAD_PART_SIZE_BYTES,
  UPLOAD_SESSION_TTL_HOURS,
  computeTotalParts,
  expectedPartSize,
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

  assertEnabled() {
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
      allowedImageMime: [...IMAGE_MIME],
      allowedVideoMime: [...VIDEO_MIME],
      storeMode: this.multipart instanceof MemoryMultipartUploadStore ? 'memory' : 's3',
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
    objectKey: string;
    partSizeBytes: number;
    totalParts: number;
    completedPartsJson: unknown;
    catalogMediaId: string | null;
    failureMessageAr: string | null;
    failureCode: string | null;
    expiresAt: Date;
    readyAt: Date | null;
    verifiedByteSize: number | null;
    verifiedMimeType: string | null;
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
      partSizeBytes: row.partSizeBytes,
      totalParts: row.totalParts,
      completedParts: parts.map((p) => ({ partNumber: p.partNumber, size: p.size, etag: p.etag })),
      uploadedBytes,
      catalogMediaId: row.catalogMediaId,
      failureMessageAr: row.failureMessageAr,
      failureCode: row.failureCode,
      expiresAt: row.expiresAt.toISOString(),
      readyAt: row.readyAt ? row.readyAt.toISOString() : null,
      verifiedByteSize: row.verifiedByteSize,
      verifiedMimeType: row.verifiedMimeType,
      // objectKey is never accepted from client; returned only as opaque server id for diagnostics (not a storage path clients may set)
      objectKeyFingerprint: createHash('sha256').update(row.objectKey).digest('hex').slice(0, 16),
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
    this.assertEnabled();
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

    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_HOURS * 3600 * 1000);
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
      return {
        ...this.publicSession(row),
        upload: {
          partSizeBytes,
          totalParts,
          concurrency: UPLOAD_PART_CONCURRENCY,
          partMaxRetries: UPLOAD_PART_MAX_RETRIES,
        },
      };
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

  async get(partnerId: string, sessionId: string) {
    this.assertEnabled();
    const row = await this.loadOwned(partnerId, sessionId);
    return this.publicSession(row);
  }

  async signPart(partnerId: string, sessionId: string, partNumber: number) {
    this.assertEnabled();
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'aborted' || row.status === 'ready' || row.status === 'failed') {
      throw new ConflictException('لا يمكن توقيع جزء لهذه الحالة');
    }
    if (row.expiresAt.getTime() < Date.now()) throw new ConflictException('انتهت صلاحية جلسة الرفع');
    const n = Number(partNumber);
    if (!Number.isInteger(n) || n < 1 || n > row.totalParts) throw new BadRequestException('رقم الجزء غير صالح');
    const expect = expectedPartSize(row.declaredByteSize, n, row.partSizeBytes);
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');

    if (row.status === 'created') {
      await this.prisma.partnerUploadSession.update({
        where: { id: row.id },
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

  async recordDirectPart(
    partnerId: string,
    sessionId: string,
    partNumber: number,
    body: Buffer,
  ) {
    this.assertEnabled();
    const row = await this.loadOwned(partnerId, sessionId);
    if (!(this.multipart instanceof MemoryMultipartUploadStore)) {
      throw new ForbiddenException('الرفع المباشر عبر API غير متاح في وضع التخزين الحالي');
    }
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');
    const n = Number(partNumber);
    const expect = expectedPartSize(row.declaredByteSize, n, row.partSizeBytes);
    if (body.length !== expect) throw new BadRequestException('حجم الجزء لا يطابق المتوقع');
    const result = await this.multipart.putPartDirect(sessionId, row.objectKey, row.storageUploadId, n, body);
    const parts = asParts(row.completedPartsJson).filter((p) => p.partNumber !== n);
    parts.push({
      partNumber: n,
      etag: result.etag,
      size: result.size,
      completedAt: new Date().toISOString(),
    });
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await this.prisma.partnerUploadSession.update({
      where: { id: row.id },
      data: {
        status: row.status === 'created' ? 'uploading' : row.status,
        completedPartsJson: parts as unknown as Prisma.InputJsonValue,
      },
    });
    return { partNumber: n, etag: result.etag, size: result.size };
  }

  async complete(
    partnerId: string,
    sessionId: string,
    input: { parts: Array<{ partNumber: number; etag: string; size: number }> },
  ) {
    this.assertEnabled();
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'ready' && row.catalogMediaId) {
      return this.publicSession(row);
    }
    if (row.status === 'verifying' || row.status === 'uploaded') {
      // Idempotent: kick finalize again without recreating storage object
      this.finalize.enqueue(row.id);
      return this.publicSession(row);
    }
    if (row.status === 'aborted') throw new ConflictException('أُلغيت جلسة الرفع');
    if (row.status === 'failed') throw new ConflictException('جلسة الرفع في حالة فشل');
    if (row.expiresAt.getTime() < Date.now()) throw new ConflictException('انتهت صلاحية جلسة الرفع');
    if (!row.storageUploadId) throw new ConflictException('معرّف الرفع مفقود');

    const incoming = Array.isArray(input.parts) ? input.parts : [];
    if (incoming.length !== row.totalParts) throw new BadRequestException('قائمة الأجزاء غير مكتملة');

    const byNum = new Map<number, { partNumber: number; etag: string; size: number }>();
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
    const parts = [...byNum.values()].sort((a, b) => a.partNumber - b.partNumber);
    const sum = parts.reduce((s, p) => s + p.size, 0);
    if (sum !== row.declaredByteSize) throw new BadRequestException('مجموع أحجام الأجزاء لا يطابق الحجم المعلن');

    // Memory adapter may already have parts recorded via direct PUT — merge etags from client
    const known = asParts(row.completedPartsJson);
    if (this.multipart instanceof MemoryMultipartUploadStore && known.length) {
      for (const p of parts) {
        const k = known.find((x) => x.partNumber === p.partNumber);
        if (k && k.size !== p.size) throw new BadRequestException('تعارض حجم الجزء المخزّن');
      }
    }

    try {
      await this.multipart.complete(row.objectKey, row.storageUploadId, parts);
    } catch (error) {
      console.error('upload-session-complete-storage-failed', error);
      throw new ServiceUnavailableException('تعذر إكمال الرفع في التخزين');
    }

    const updated = await this.prisma.partnerUploadSession.update({
      where: { id: row.id },
      data: {
        status: 'uploaded',
        completedPartsJson: parts.map((p) => ({
          ...p,
          completedAt: new Date().toISOString(),
        })) as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        failureCode: null,
        failureMessageAr: null,
      },
    });
    this.finalize.enqueue(updated.id);
    return this.publicSession(updated);
  }

  async abort(partnerId: string, sessionId: string) {
    this.assertEnabled();
    const row = await this.loadOwned(partnerId, sessionId);
    if (row.status === 'ready' && row.catalogMediaId) {
      // Do not delete bound media
      return this.publicSession(row);
    }
    if (row.status === 'aborted') return this.publicSession(row);
    if (row.status === 'verifying') {
      // Race: mark abort intent only if finalize has not bound yet — finalize checks status
      const raced = await this.prisma.partnerUploadSession.updateMany({
        where: { id: row.id, status: 'verifying', catalogMediaId: null },
        data: { status: 'aborted', abortedAt: new Date(), failureCode: 'aborted', failureMessageAr: 'أُلغي الرفع' },
      });
      if (!raced.count) {
        const latest = await this.loadOwned(partnerId, sessionId);
        return this.publicSession(latest);
      }
    } else if (row.status !== 'ready') {
      await this.prisma.partnerUploadSession.update({
        where: { id: row.id },
        data: {
          status: 'aborted',
          abortedAt: new Date(),
          failureCode: 'aborted',
          failureMessageAr: 'أُلغي الرفع',
        },
      });
    }
    if (row.storageUploadId && row.status !== 'uploaded' && row.status !== 'ready' && row.status !== 'verifying') {
      try {
        await this.multipart.abort(row.objectKey, row.storageUploadId);
      } catch (error) {
        console.error('upload-session-abort-storage-failed', error);
      }
    }
    return this.publicSession(await this.loadOwned(partnerId, sessionId));
  }

  /** Test helper: expose multipart memory store when used. */
  getMultipartStore(): MultipartUploadStore {
    return this.multipart;
  }

  getCatalogStorage(): CatalogMediaStorage {
    return this.storage;
  }
}
