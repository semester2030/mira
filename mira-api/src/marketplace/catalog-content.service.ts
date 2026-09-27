import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FIELD_OWNERSHIP, IMAGE_MAX_BYTES, IMAGE_MIME, VIDEO_MAX_BYTES, VIDEO_MIME, sniffMedia } from './catalog-content.policy';
import {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
} from './catalog-media.storage';

type Kind = 'product' | 'service';
const DECISIONS = new Set(['approve', 'reject', 'withdraw']);

export type ImportItem = {
  externalId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  priceHalalas: number;
  available?: boolean;
  removed?: boolean;
  syncError?: boolean;
  failBeforeLink?: boolean;
  failMediaAt?: number;
  media?: { mimeType: string; dataBase64: string; sourceMediaKey?: string }[];
};

type OwnerRow = {
  id: string;
  partnerId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  priceHalalas: number;
  active: boolean;
  contentStatus: string;
  reviewStatus: string;
  reviewNote: string | null;
  reviewRevision: number;
  submittedRevision: number | null;
  draftNameAr: string | null;
  draftNameEn: string | null;
  draftDescriptionAr: string | null;
};

@Injectable()
export class CatalogContentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  policy() {
    return {
      videoOptional: true,
      imagesAloneCanPublish: true,
      purchaseAr: 'فتح الرابط ليس شراءً مكتملًا. لا توجد سلة أو محفظة داخل ميرا في هذه المرحلة.',
      appointmentAr: 'طلب الموعد غير متاح تشغيليًا وليس حجزًا مؤكدًا.',
      merchantWithoutStoreAr: 'DEC-0007 ما زال يحتاج قرار المالك. إدارة المحتوى لا تنشئ طلبات أو دفعًا.',
      importAr: 'لا تكامل متجر خارجي معتمد. الاستيراد التجريبي موسوم simulated وليس اتصالًا حقيقيًا.',
      fields: FIELD_OWNERSHIP,
    };
  }

  async addMedia(partnerId: string, kind: Kind, id: string, input: { mimeType: string; dataBase64: string; sourceMediaKey?: string }) {
    await this.owned(partnerId, kind, id);
    const mime = input.mimeType;
    const image = IMAGE_MIME.has(mime);
    const video = VIDEO_MIME.has(mime);
    if (!image && !video) throw new BadRequestException('نوع الملف غير مقبول');
    let bytes: Buffer;
    try {
      bytes = Buffer.from(input.dataBase64, 'base64');
    } catch {
      throw new BadRequestException('تعذر قراءة الملف');
    }
    const limit = image ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (!bytes.length || bytes.length > limit) throw new BadRequestException('حجم الملف خارج الحد');
    if (!sniffMedia(mime, bytes)) throw new BadRequestException('محتوى الملف لا يطابق نوعه');
    const key = randomUUID();
    try {
      await this.storage.put(key, bytes);
    } catch (error) {
      if (error instanceof CatalogMediaUnavailable) {
        throw new ServiceUnavailableException('تخزين الوسائط الدائم غير مهيأ');
      }
      if (error instanceof CatalogMediaConnectionError) {
        console.error('catalog-media-connection-failed');
        throw new ServiceUnavailableException('تعذر الاتصال بتخزين الوسائط');
      }
      if (error instanceof CatalogMediaPermissionError) {
        console.error('catalog-media-permission');
        throw new ServiceUnavailableException('تعذر حفظ الملف');
      }
      throw new BadRequestException('تعذر حفظ الملف');
    }
    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        if (process.env.MIRA_CATALOG_FAIL_MEDIA_TX === '1') {
          console.error('catalog-media-failpoint-after-upload');
          throw new Error('catalog-media-failpoint-after-upload');
        }
        const locked = await this.lockOwner(tx, kind, id);
        if (locked.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
        if (input.sourceMediaKey) {
          const existing = await tx.catalogMedia.findFirst({
            where: { ownerKind: kind, ownerId: id, sourceMediaKey: input.sourceMediaKey },
          });
          if (existing) return existing;
        }
        const count = await tx.catalogMedia.count({ where: { ownerKind: kind, ownerId: id } });
        const published = locked.contentStatus === 'published';
        const firstImage = count === 0 && image;
        const created = await tx.catalogMedia.create({
          data: {
            ownerKind: kind,
            ownerId: id,
            sortOrder: count,
            draftSortOrder: published ? count : null,
            kind: image ? 'image' : 'video',
            url: '',
            active: false,
            mimeType: mime,
            byteSize: bytes.length,
            storageKey: key,
            isPrimary: published ? false : firstImage,
            draftIsPrimary: firstImage ? true : null,
            publication: 'draft',
            sourceMediaKey: input.sourceMediaKey,
          },
        });
        await this.bumpRevision(tx, kind, id);
        return created;
      });
      if (saved.storageKey !== key) await this.storage.delete(key);
      return saved;
    } catch (error) {
      try {
        await this.storage.delete(key);
      } catch {
        console.error('catalog-media-cleanup-failed', key);
      }
      throw error;
    }
  }

  async reorder(partnerId: string, kind: Kind, id: string, ids: string[]) {
    await this.owned(partnerId, kind, id);
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.lockOwner(tx, kind, id);
      if (owner.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
      const rows = await tx.catalogMedia.findMany({ where: { ownerKind: kind, ownerId: id } });
      const known = new Set(rows.map((row) => row.id));
      if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((item) => !known.has(item))) {
        throw new BadRequestException('ترتيب الوسائط لا يطابق السجلات');
      }
      const published = owner.contentStatus === 'published';
      for (const [index, mediaId] of ids.entries()) {
        await tx.catalogMedia.update({
          where: { id: mediaId },
          data: published ? { draftSortOrder: index } : { sortOrder: index, draftSortOrder: index },
        });
      }
      await this.bumpRevision(tx, kind, id);
    });
    return { ok: true };
  }

  async setPrimary(partnerId: string, kind: Kind, id: string, mediaId: string) {
    await this.owned(partnerId, kind, id);
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.lockOwner(tx, kind, id);
      if (owner.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
      const row = await tx.catalogMedia.findFirst({ where: { id: mediaId, ownerKind: kind, ownerId: id } });
      if (!row || row.kind !== 'image' || row.pendingRemoval) throw new BadRequestException('الوسيط الرئيسي يجب أن يكون صورة تابعة لهذا العنصر');
      const published = owner.contentStatus === 'published' || row.publication === 'published';
      if (published) {
        await tx.catalogMedia.updateMany({ where: { ownerKind: kind, ownerId: id }, data: { draftIsPrimary: false } });
        await tx.catalogMedia.update({ where: { id: mediaId }, data: { draftIsPrimary: true } });
      } else {
        await tx.catalogMedia.updateMany({ where: { ownerKind: kind, ownerId: id }, data: { isPrimary: false, draftIsPrimary: false } });
        await tx.catalogMedia.update({ where: { id: mediaId }, data: { isPrimary: true, draftIsPrimary: true } });
      }
      await this.bumpRevision(tx, kind, id);
    });
    return { ok: true };
  }

  async removeMedia(partnerId: string, kind: Kind, id: string, mediaId: string) {
    await this.owned(partnerId, kind, id);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const owner = await this.lockOwner(tx, kind, id);
      if (owner.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
      const row = await tx.catalogMedia.findFirst({ where: { id: mediaId, ownerKind: kind, ownerId: id } });
      if (!row) throw new NotFoundException('الوسيط غير موجود');
      if (row.publication === 'published') {
        await tx.catalogMedia.update({ where: { id: mediaId }, data: { pendingRemoval: true } });
        await this.bumpRevision(tx, kind, id);
        return { removed: 'pending_review' as const, storageKey: null as string | null };
      }
      await tx.catalogMedia.delete({ where: { id: mediaId } });
      await this.bumpRevision(tx, kind, id);
      return { removed: 'draft' as const, storageKey: row.storageKey };
    });
    if (outcome.removed === 'draft' && outcome.storageKey) {
      try {
        await this.storage.delete(outcome.storageKey);
      } catch {
        console.error('catalog-media-cleanup-failed', outcome.storageKey);
      }
    }
    return { removed: outcome.removed };
  }

  async submit(partnerId: string, kind: Kind, id: string) {
    await this.owned(partnerId, kind, id);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockOwner(tx, kind, id);
      if (row.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
      const media = await tx.catalogMedia.findMany({ where: { ownerKind: kind, ownerId: id } });
      if (!media.some((item) => item.kind === 'image' && !item.pendingRemoval)) {
        throw new BadRequestException('صورة واحدة على الأقل مطلوبة. الفيديو اختياري');
      }
      if (row.reviewStatus === 'in_review' && row.submittedRevision === row.reviewRevision) {
        return { contentStatus: row.contentStatus, reviewStatus: 'in_review', id: row.id, alreadyApplied: true };
      }
      const revision = row.reviewRevision;
      if (kind === 'product') {
        await tx.product.update({
          where: { id },
          data: { reviewStatus: 'in_review', submittedRevision: revision, submittedAt: new Date(), reviewNote: null },
        });
      } else {
        await tx.service.update({
          where: { id },
          data: { reviewStatus: 'in_review', submittedRevision: revision, submittedAt: new Date(), reviewNote: null },
        });
      }
      await tx.catalogReviewLog.create({ data: { ownerKind: kind, ownerId: id, actor: `partner:${partnerId}`, action: 'submit', note: null } });
      return { contentStatus: row.contentStatus, reviewStatus: 'in_review', revision, id: row.id };
    });
  }

  async decide(actor: string, kind: string, id: string, decision: string | undefined, note?: string, revision?: number) {
    if (actor.startsWith('partner:')) throw new ForbiddenException('الشريك لا يمنح نفسه اعتماد الإدارة');
    if (kind !== 'product' && kind !== 'service') throw new BadRequestException('نوع العنصر غير صالح');
    if (!decision || !DECISIONS.has(decision)) throw new BadRequestException('القرار غير معروف');
    const typedKind = kind as Kind;
    const exists = await this.ownedRow(typedKind, id);
    if (!exists) throw new NotFoundException('العنصر غير موجود');
    const outcome = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockOwner(tx, typedKind, id);
      if (decision === 'withdraw') {
        if (row.contentStatus === 'withdrawn') return { contentStatus: 'withdrawn', alreadyApplied: true, id };
        await this.applyOwner(tx, typedKind, id, {
          contentStatus: 'withdrawn',
          active: false,
          reviewStatus: 'none',
          reviewedAt: new Date(),
          reviewedBy: actor,
          reviewNote: note ?? null,
        });
        await tx.catalogReviewLog.create({ data: { ownerKind: typedKind, ownerId: id, actor, action: 'withdraw', note: note ?? null } });
        return { contentStatus: 'withdrawn', id };
      }
      if (decision === 'approve' && row.reviewStatus === 'none' && row.contentStatus === 'published') {
        return { contentStatus: 'published', alreadyApplied: true, id };
      }
      if (decision === 'reject' && row.reviewStatus === 'rejected') {
        return { contentStatus: row.contentStatus, reviewStatus: 'rejected', alreadyApplied: true, id };
      }
      if (row.contentStatus === 'withdrawn') throw new ConflictException('العنصر سُحب قبل إتمام هذا القرار');
      if (row.reviewStatus !== 'in_review' || revision == null || revision !== row.submittedRevision || revision !== row.reviewRevision) {
        throw new ConflictException('المسودة تغيرت بعد النسخة التي عُوينت');
      }
      if (decision === 'reject') {
        await this.applyOwner(tx, typedKind, id, {
          reviewStatus: 'rejected',
          reviewNote: note ?? 'يحتاج تعديلًا',
          reviewedAt: new Date(),
          reviewedBy: actor,
        });
        await tx.catalogReviewLog.create({ data: { ownerKind: typedKind, ownerId: id, actor, action: 'reject', note: note ?? null } });
        return { contentStatus: row.contentStatus, reviewStatus: 'rejected', id };
      }
      const media = await tx.catalogMedia.findMany({ where: { ownerKind: typedKind, ownerId: id } });
      const images = media.filter((item) => item.kind === 'image' && !item.pendingRemoval);
      if (images.length === 0) throw new BadRequestException('لا يمكن الاعتماد بلا صورة تبقى منشورة');
      const keysToDelete = media.filter((item) => item.pendingRemoval && item.storageKey).map((item) => item.storageKey as string);
      for (const item of media.filter((entry) => entry.pendingRemoval)) {
        await tx.catalogMedia.delete({ where: { id: item.id } });
      }
      for (const item of media.filter((entry) => !entry.pendingRemoval)) {
        await tx.catalogMedia.update({
          where: { id: item.id },
          data: {
            sortOrder: item.draftSortOrder ?? item.sortOrder,
            isPrimary: item.draftIsPrimary ?? item.isPrimary,
            draftSortOrder: null,
            draftIsPrimary: null,
            publication: 'published',
            active: true,
            url: `/api/v1/marketplace/media/${item.id}`,
          },
        });
      }
      if (process.env.MIRA_CATALOG_FAIL_PUBLISH === '1') {
        console.error('catalog-publish-failpoint-after-write');
        throw new Error('فشل الكتابة داخل معاملة النشر بعد بدء الكتابة');
      }
      const published = {
        contentStatus: 'published',
        active: true,
        reviewStatus: 'none',
        reviewNote: null,
        reviewedAt: new Date(),
        reviewedBy: actor,
        submittedRevision: null,
        draftNameAr: null,
        draftNameEn: null,
        draftDescriptionAr: null,
        ...(row.draftNameAr != null && row.draftNameAr !== '' ? { nameAr: row.draftNameAr } : {}),
        ...(row.draftNameEn != null && row.draftNameEn !== '' ? { nameEn: row.draftNameEn } : {}),
        ...(row.draftDescriptionAr != null ? { descriptionAr: row.draftDescriptionAr === '' ? null : row.draftDescriptionAr } : {}),
      };
      const changed = typedKind === 'product'
        ? await tx.product.updateMany({
          where: { id, reviewStatus: 'in_review', reviewRevision: revision, submittedRevision: revision, contentStatus: { not: 'withdrawn' } },
          data: published,
        })
        : await tx.service.updateMany({
          where: { id, reviewStatus: 'in_review', reviewRevision: revision, submittedRevision: revision, contentStatus: { not: 'withdrawn' } },
          data: published,
        });
      if (changed.count !== 1) throw new ConflictException('المسودة تغيرت بعد النسخة التي عُوينت');
      await tx.catalogReviewLog.create({ data: { ownerKind: typedKind, ownerId: id, actor, action: 'approve', note: note ?? null } });
      return { contentStatus: 'published', id, keysToDelete };
    });
    const keys = ('keysToDelete' in outcome ? outcome.keysToDelete : []) ?? [];
    let cleanupPending = false;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch {
        cleanupPending = true;
        console.error('catalog-media-cleanup-failed', key);
      }
    }
    const { keysToDelete: _keys, ...body } = outcome as { keysToDelete?: string[] };
    return { ...body, cleanupPending };
  }

  async listReviews() {
    const where = { reviewStatus: 'in_review' };
    const [products, services] = await Promise.all([
      this.prisma.product.findMany({ where, include: { partner: true } }),
      this.prisma.service.findMany({ where, include: { partner: true } }),
    ]);
    return {
      items: [
        ...products.map((item) => this.queueItem('product', item)),
        ...services.map((item) => this.queueItem('service', item)),
      ],
    };
  }

  async preview(partnerId: string | null, kind: Kind, id: string) {
    const row = await this.ownedRow(kind, id);
    if (!row) throw new NotFoundException('العنصر غير موجود');
    if (partnerId && row.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
    const media = await this.prisma.catalogMedia.findMany({ where: { ownerKind: kind, ownerId: id } });
    const ordered = [...media].sort((a, b) => (a.draftSortOrder ?? a.sortOrder) - (b.draftSortOrder ?? b.sortOrder));
    return {
      id: row.id,
      kind,
      partnerId: row.partnerId,
      contentStatus: row.contentStatus,
      reviewStatus: row.reviewStatus,
      reviewNote: row.reviewNote,
      revision: row.reviewRevision,
      submittedRevision: row.submittedRevision,
      publishedNameAr: row.nameAr,
      draftNameAr: row.draftNameAr,
      publishedNameEn: row.nameEn,
      draftNameEn: row.draftNameEn,
      publishedDescriptionAr: row.descriptionAr,
      draftDescriptionAr: row.draftDescriptionAr,
      priceHalalas: row.priceHalalas,
      media: ordered.map((item) => ({
        id: item.id,
        kind: item.kind,
        publication: item.publication,
        isPrimary: item.isPrimary,
        draftIsPrimary: item.draftIsPrimary,
        sortOrder: item.sortOrder,
        draftSortOrder: item.draftSortOrder,
        pendingRemoval: item.pendingRemoval,
        mimeType: item.mimeType,
      })),
    };
  }

  async readPartnerMedia(partnerId: string, mediaId: string) {
    return this.readStoredMedia(mediaId, partnerId);
  }

  async readReviewMedia(mediaId: string) {
    return this.readStoredMedia(mediaId, null);
  }

  async importSimulated(partnerId: string, items: ImportItem[]) {
    if (process.env.NODE_ENV === 'production' && process.env.MIRA_ALLOW_SIMULATED_IMPORT !== 'true') {
      throw new ForbiddenException('الاستيراد التجريبي غير متاح في هذا التشغيل');
    }
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.type !== 'brand') throw new BadRequestException('استيراد المنتجات للماركات فقط');
    let created = 0;
    let updated = 0;
    const errors: { externalId: string; message: string }[] = [];
    const results: { externalId: string; status: string; mediaAdded: number; message?: string }[] = [];
    for (const item of items) {
      if (item.syncError) {
        errors.push({ externalId: item.externalId, message: 'تعذر الاتصال بالمصدر. السعر والتوفر لم يتغيرا' });
        results.push({ externalId: item.externalId, status: 'error', mediaAdded: 0, message: 'تعذر الاتصال بالمصدر' });
        continue;
      }
      try {
        const outcome = await this.upsertImported(partnerId, item);
        let mediaAdded = 0;
        const mediaErrors: string[] = [];
        for (const [index, media] of (item.media ?? []).entries()) {
          if (item.failMediaAt === index) {
            mediaErrors.push(`تعذر وسيط ${index}`);
            continue;
          }
          try {
            const before = await this.prisma.catalogMedia.count({
              where: { ownerId: outcome.ownerId, sourceMediaKey: media.sourceMediaKey ?? String(index) },
            });
            await this.addMedia(partnerId, 'product', outcome.ownerId, {
              ...media,
              sourceMediaKey: media.sourceMediaKey ?? String(index),
            });
            const after = await this.prisma.catalogMedia.count({
              where: { ownerId: outcome.ownerId, sourceMediaKey: media.sourceMediaKey ?? String(index) },
            });
            if (after > before) mediaAdded += 1;
          } catch (error) {
            mediaErrors.push(error instanceof Error ? error.message : 'تعذر وسيط');
          }
        }
        if (outcome.created) created += 1;
        else updated += 1;
        if (mediaErrors.length) errors.push({ externalId: item.externalId, message: mediaErrors.join('؛ ') });
        results.push({ externalId: item.externalId, status: outcome.created ? 'created' : 'updated', mediaAdded, message: mediaErrors.join('؛ ') || undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'تعذر الاستيراد';
        errors.push({ externalId: item.externalId, message });
        results.push({ externalId: item.externalId, status: 'error', mediaAdded: 0, message });
      }
    }
    return { mode: 'simulated', connected: false, created, updated, errors, results };
  }

  async setMiraNote(partnerId: string, externalId: string, note: string) {
    const link = await this.prisma.catalogSourceLink.findUnique({
      where: { partnerId_source_externalId: { partnerId, source: 'simulated', externalId } },
    });
    if (!link) throw new NotFoundException('الربط غير موجود');
    return this.prisma.catalogSourceLink.update({ where: { id: link.id }, data: { miraNoteAr: note } });
  }

  private async upsertImported(partnerId: string, item: ImportItem) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `${partnerId}:simulated:${item.externalId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const link = await tx.catalogSourceLink.findUnique({
        where: { partnerId_source_externalId: { partnerId, source: 'simulated', externalId: item.externalId } },
      });
      if (!link) {
        const product = await tx.product.create({
          data: {
            partnerId,
            nameAr: item.nameAr,
            nameEn: item.nameEn ?? item.nameAr,
            descriptionAr: item.descriptionAr,
            priceHalalas: item.priceHalalas,
            externalUrl: 'https://example.com/simulated',
            concernTags: [],
            skinTypes: [],
            active: false,
            contentStatus: 'draft',
            reviewStatus: 'draft',
            catalogSource: 'simulated',
          },
        });
        if (item.failBeforeLink) throw new Error('فشل الربط قبل إكماله');
        await tx.catalogSourceLink.create({
          data: { partnerId, ownerKind: 'product', ownerId: product.id, source: 'simulated', externalId: item.externalId, lastSyncedAt: new Date() },
        });
        return { ownerId: product.id, created: true };
      }
      const current = await tx.product.findUniqueOrThrow({ where: { id: link.ownerId } });
      const data: Prisma.ProductUpdateInput = {};
      const nameChanged = item.nameAr !== (current.draftNameAr ?? current.nameAr);
      if (nameChanged) {
        data.draftNameAr = item.nameAr;
        data.reviewRevision = { increment: 1 };
      }
      if (!item.removed && item.available !== false && current.contentStatus !== 'withdrawn') data.priceHalalas = item.priceHalalas;
      if (item.removed) {
        data.active = false;
        data.contentStatus = 'withdrawn';
      } else if (current.contentStatus === 'withdrawn') {
        data.active = false;
      } else if (item.available === false) {
        data.active = false;
      } else if (current.contentStatus === 'published') {
        data.active = true;
      }
      await tx.product.update({ where: { id: link.ownerId }, data });
      await tx.catalogSourceLink.update({ where: { id: link.id }, data: { lastSyncedAt: new Date() } });
      return { ownerId: link.ownerId, created: false };
    });
  }

  private queueItem(kind: Kind, item: { id: string; nameAr: string; draftNameAr: string | null; partnerId: string; priceHalalas: number; reviewRevision: number; submittedRevision: number | null }) {
    return {
      kind,
      id: item.id,
      nameAr: item.draftNameAr ?? item.nameAr,
      partnerId: item.partnerId,
      priceHalalas: item.priceHalalas,
      revision: item.submittedRevision ?? item.reviewRevision,
    };
  }

  private async assertImages(kind: Kind, id: string) {
    const media = await this.prisma.catalogMedia.findMany({ where: { ownerKind: kind, ownerId: id } });
    const images = media.filter((item) => item.kind === 'image' && !item.pendingRemoval);
    if (images.length === 0) throw new BadRequestException('صورة واحدة على الأقل مطلوبة. الفيديو اختياري');
  }

  private async lockOwner(tx: Prisma.TransactionClient, kind: Kind, id: string): Promise<OwnerRow> {
    if (kind === 'product') {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
      const row = await tx.product.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('العنصر غير موجود');
      return row;
    }
    await tx.$queryRaw`SELECT id FROM services WHERE id = ${id} FOR UPDATE`;
    const row = await tx.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('العنصر غير موجود');
    return row;
  }

  private bumpRevision(tx: Prisma.TransactionClient, kind: Kind, id: string) {
    const data = { reviewRevision: { increment: 1 } };
    if (kind === 'product') return tx.product.update({ where: { id }, data });
    return tx.service.update({ where: { id }, data });
  }

  private applyOwner(tx: Prisma.TransactionClient, kind: Kind, id: string, data: Prisma.ProductUpdateInput) {
    if (kind === 'product') return tx.product.update({ where: { id }, data });
    return tx.service.update({ where: { id }, data: data as Prisma.ServiceUpdateInput });
  }

  private async readStoredMedia(mediaId: string, partnerId: string | null) {
    const row = await this.prisma.catalogMedia.findUnique({ where: { id: mediaId } });
    if (!row?.storageKey) throw new NotFoundException('الوسيط غير موجود');
    const owner = await this.ownedRow(row.ownerKind as Kind, row.ownerId);
    if (!owner) throw new NotFoundException('الوسيط غير موجود');
    if (partnerId && owner.partnerId !== partnerId) throw new NotFoundException('الوسيط غير موجود');
    let bytes: Buffer | null;
    try {
      bytes = await this.storage.get(row.storageKey);
    } catch (error) {
      if (error instanceof CatalogMediaPermissionError) console.error('catalog-media-permission');
      else if (error instanceof CatalogMediaConnectionError) console.error('catalog-media-connection-failed');
      else console.error('catalog-media-read-failed');
      throw new NotFoundException('الوسيط غير منشور');
    }
    if (!bytes) {
      console.error('catalog-media-missing');
      throw new NotFoundException('الوسيط غير منشور');
    }
    return { bytes, mimeType: row.mimeType ?? 'application/octet-stream' };
  }

  private async owned(partnerId: string, kind: Kind, id: string) {
    const row = await this.ownedRow(kind, id);
    if (!row || row.partnerId !== partnerId) throw new NotFoundException('العنصر غير موجود');
    return row;
  }

  private async ownedRow(kind: Kind, id: string): Promise<OwnerRow | null> {
    if (kind === 'product') return this.prisma.product.findUnique({ where: { id } });
    if (kind === 'service') return this.prisma.service.findUnique({ where: { id } });
    throw new BadRequestException('نوع العنصر غير صالح');
  }

  private write(kind: Kind, id: string, data: Prisma.ProductUpdateInput) {
    if (kind === 'product') return this.prisma.product.update({ where: { id }, data });
    return this.prisma.service.update({ where: { id }, data: data as Prisma.ServiceUpdateInput });
  }

  private log(kind: Kind, id: string, actor: string, action: string, note: string | null) {
    return this.prisma.catalogReviewLog.create({ data: { ownerKind: kind, ownerId: id, actor, action, note } });
  }
}
