import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  IMAGE_MAX_BYTES,
  IMAGE_MIME,
  MAIN_MAX_IMAGES,
  MAIN_MAX_VIDEOS,
  VIDEO_MAX_BYTES,
  VIDEO_MIME,
  mainPlacementCapMessage,
  sniffMedia,
} from './catalog-content.policy';
import { videoDurationRejection } from './catalog-video-duration';
import {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
} from './catalog-media.storage';
import { publishedCatalogMediaWhere } from './catalog-published-media';
import { filterPlayableCatalogMedia } from './catalog-media-playable';

/** Celebrity-ad media: owned by the ad, never the merchant product/service rows. */
@Injectable()
export class CatalogAdMediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  async addMedia(
    partnerId: string,
    adId: string,
    input: { mimeType: string; dataBase64: string; placement?: string; sourceMediaKey?: string },
  ) {
    const ad = await this.ownedDraftable(partnerId, adId);
    const mime = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
    const image = IMAGE_MIME.has(mime);
    const video = VIDEO_MIME.has(mime);
    if (!image && !video) throw new BadRequestException('صيغة الملف غير مقبولة');
    const bytes = Buffer.from(input.dataBase64 || '', 'base64');
    const limit = image ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (!bytes.length || bytes.length > limit) {
      throw new BadRequestException(
        video
          ? 'حجم الملف يتجاوز حد الرفع على هذا الخادم. المدة المسموحة 5 دقائق.'
          : 'حجم الملف خارج الحد',
      );
    }
    if (!sniffMedia(mime, bytes)) throw new BadRequestException('محتوى الملف غير صالح');
    if (video) {
      const rejection = videoDurationRejection(bytes);
      if (rejection) throw new BadRequestException(rejection);
    }
    const placement = input.placement === 'detail' || input.placement === 'cover' ? input.placement : 'main';
    const key = randomUUID();
    try {
      await this.storage.put(key, bytes);
    } catch (error) {
      if (error instanceof CatalogMediaUnavailable) {
        throw new ServiceUnavailableException('تخزين الوسائط الدائم غير مهيأ');
      }
      if (error instanceof CatalogMediaConnectionError) {
        throw new ServiceUnavailableException('تعذر الاتصال بتخزين الوسائط');
      }
      if (error instanceof CatalogMediaPermissionError) {
        throw new ServiceUnavailableException('تعذر حفظ الملف');
      }
      throw new BadRequestException('تعذر حفظ الملف');
    }
    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        if (input.sourceMediaKey) {
          const existing = await tx.catalogMedia.findFirst({
            where: { ownerKind: 'ad', ownerId: adId, sourceMediaKey: input.sourceMediaKey },
          });
          if (existing) return existing;
        }
        if (placement === 'main') {
          const mainKind = image ? 'image' : 'video';
          const mainCount = await tx.catalogMedia.count({
            where: {
              ownerKind: 'ad',
              ownerId: adId,
              kind: mainKind,
              placement: 'main',
              pendingRemoval: false,
            },
          });
          const cap = image ? MAIN_MAX_IMAGES : MAIN_MAX_VIDEOS;
          if (mainCount >= cap) throw new BadRequestException(mainPlacementCapMessage(mainKind));
        }
        const count = await tx.catalogMedia.count({ where: { ownerKind: 'ad', ownerId: adId } });
        const live = ad.status === 'published';
        return tx.catalogMedia.create({
          data: {
            ownerKind: 'ad',
            ownerId: adId,
            sortOrder: count,
            draftSortOrder: live ? count : null,
            kind: image ? 'image' : 'video',
            url: '',
            active: live,
            mimeType: video ? 'video/mp4' : mime,
            byteSize: bytes.length,
            storageKey: key,
            isPrimary: count === 0,
            draftIsPrimary: count === 0 ? true : null,
            publication: live ? 'published' : 'draft',
            placement,
            sourceMediaKey: input.sourceMediaKey,
          },
        });
      });
      if (saved.storageKey !== key) await this.storage.delete(key);
      return this.mediaView(saved);
    } catch (error) {
      try {
        await this.storage.delete(key);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  async listMedia(partnerId: string, adId: string) {
    await this.owned(partnerId, adId);
    const rows = await this.prisma.catalogMedia.findMany({
      where: { ownerKind: 'ad', ownerId: adId, pendingRemoval: false },
      orderBy: { sortOrder: 'asc' },
    });
    return { items: rows.map((row) => this.mediaView(row)) };
  }

  async reorder(partnerId: string, adId: string, ids: string[]) {
    await this.ownedDraftable(partnerId, adId);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.catalogMedia.findMany({ where: { ownerKind: 'ad', ownerId: adId } });
      const known = new Set(rows.map((row) => row.id));
      if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
        throw new BadRequestException('ترتيب الوسائط لا يطابق السجلات');
      }
      for (let i = 0; i < ids.length; i += 1) {
        await tx.catalogMedia.update({ where: { id: ids[i] }, data: { sortOrder: i, draftSortOrder: i } });
      }
    });
    return this.listMedia(partnerId, adId);
  }

  async setPrimary(partnerId: string, adId: string, mediaId: string) {
    await this.ownedDraftable(partnerId, adId);
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogMedia.findFirst({ where: { id: mediaId, ownerKind: 'ad', ownerId: adId } });
      if (!row) throw new NotFoundException('الوسيط غير موجود');
      await tx.catalogMedia.updateMany({ where: { ownerKind: 'ad', ownerId: adId }, data: { isPrimary: false, draftIsPrimary: false } });
      await tx.catalogMedia.update({ where: { id: mediaId }, data: { isPrimary: true, draftIsPrimary: true } });
    });
    return this.listMedia(partnerId, adId);
  }

  async removeMedia(partnerId: string, adId: string, mediaId: string) {
    await this.ownedDraftable(partnerId, adId);
    const row = await this.prisma.catalogMedia.findFirst({ where: { id: mediaId, ownerKind: 'ad', ownerId: adId } });
    if (!row) throw new NotFoundException('الوسيط غير موجود');
    const key = row.storageKey;
    await this.prisma.catalogMedia.delete({ where: { id: mediaId } });
    if (key) {
      try {
        await this.storage.delete(key);
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  }

  /** Publish all draft ad media when the ad goes live. Does not touch product/service media. */
  async publishAllForAd(adId: string) {
    await this.prisma.catalogMedia.updateMany({
      where: { ownerKind: 'ad', ownerId: adId },
      data: { publication: 'published', active: true },
    });
  }

  async publicMediaForAd(adId: string, fallbackKind: 'product' | 'service', fallbackId: string) {
    const own = filterPlayableCatalogMedia(
      await this.prisma.catalogMedia.findMany({
        where: publishedCatalogMediaWhere('ad', adId),
        orderBy: { sortOrder: 'asc' },
      }),
    );
    if (own.length > 0) {
      return own.map((row) => ({ id: row.id, kind: row.kind, url: `/api/v1/marketplace/media/${row.id}`, sortOrder: row.sortOrder, isPrimary: row.isPrimary }));
    }
    // Legacy ads: fall back to the linked offer media so old rows keep playing.
    const legacy = filterPlayableCatalogMedia(
      await this.prisma.catalogMedia.findMany({
        where: publishedCatalogMediaWhere(fallbackKind, fallbackId),
        orderBy: { sortOrder: 'asc' },
      }),
    );
    return legacy.map((row) => ({ id: row.id, kind: row.kind, url: `/api/v1/marketplace/media/${row.id}`, sortOrder: row.sortOrder, isPrimary: row.isPrimary }));
  }

  private mediaView(row: {
    id: string;
    kind: string;
    sortOrder: number;
    isPrimary: boolean;
    publication: string;
    placement: string;
    mimeType: string | null;
    byteSize: number | null;
  }) {
    return {
      id: row.id,
      kind: row.kind,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      publication: row.publication,
      placement: row.placement,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      url: `/api/v1/marketplace/media/${row.id}`,
    };
  }

  private async owned(partnerId: string, adId: string) {
    const ad = await this.prisma.catalogAd.findFirst({ where: { id: adId, advertiserPartnerId: partnerId } });
    if (!ad) throw new NotFoundException('الإعلان غير موجود');
    return ad;
  }

  private async ownedDraftable(partnerId: string, adId: string) {
    const ad = await this.owned(partnerId, adId);
    if (ad.status !== 'draft' && ad.status !== 'rejected' && ad.status !== 'published') {
      throw new BadRequestException('لا يمكن تعديل وسائط هذا الإعلان في حالته الحالية');
    }
    return ad;
  }
}
