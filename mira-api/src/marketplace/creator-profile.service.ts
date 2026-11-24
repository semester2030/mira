import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_MAX_BYTES, IMAGE_MIME, sniffMedia } from './catalog-content.policy';
import {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
} from './catalog-media.storage';

const DIRECTORY_PAGE_DEFAULT = 6;
const DIRECTORY_PAGE_MAX = 24;

@Injectable()
export class CreatorProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  /** Upsert profile for the logged-in partner. Second call returns the same row. */
  async registerOrUpdate(partnerId: string, input: Record<string, unknown>) {
    await this.requireActivePartner(partnerId);
    const displayNameAr = this.requiredText(input.displayNameAr, 'اسم العرض');
    const bioAr = this.optionalText(input.bioAr);
    const publicActive = input.publicActive === undefined ? true : input.publicActive === true;

    const existing = await this.prisma.creatorProfile.findUnique({ where: { partnerId } });
    if (existing) {
      return this.prisma.creatorProfile.update({
        where: { partnerId },
        data: { displayNameAr, bioAr: bioAr ?? null, publicActive },
      }).then((row) => this.partnerView(row));
    }

    try {
      const created = await this.prisma.creatorProfile.create({
        data: { partnerId, displayNameAr, bioAr: bioAr ?? null, publicActive },
      });
      return this.partnerView(created);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        const again = await this.prisma.creatorProfile.findUnique({ where: { partnerId } });
        if (again) return this.partnerView(again);
        throw new ConflictException('ملف المشهور موجود مسبقًا');
      }
      throw error;
    }
  }

  async mine(partnerId: string) {
    const row = await this.prisma.creatorProfile.findUnique({ where: { partnerId } });
    if (!row) return { registered: false as const, profile: null };
    return { registered: true as const, profile: this.partnerView(row) };
  }

  async setAvatar(partnerId: string, input: { mimeType: string; dataBase64: string }) {
    const bytes = Buffer.from(input.dataBase64 || '', 'base64');
    return this.setAvatarBytes(partnerId, {
      mimeType: input.mimeType,
      bytes,
    });
  }

  /** Prefer multipart bytes from the browser file input (Safari Lockdown has no FileReader). */
  async setAvatarBytes(partnerId: string, input: { mimeType: string; bytes: Buffer }) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { partnerId } });
    if (!profile) throw new NotFoundException('سجّلي كمشهورة أولًا');
    const mime = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
    if (!IMAGE_MIME.has(mime)) throw new BadRequestException('صيغة صورة الملف غير مقبولة');
    const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.alloc(0);
    if (!bytes.length || bytes.length > IMAGE_MAX_BYTES) {
      throw new BadRequestException('حجم صورة الملف خارج الحد');
    }
    if (!sniffMedia(mime, bytes)) throw new BadRequestException('محتوى الصورة غير صالح');
    const key = `creator-avatar/${partnerId}/${randomUUID()}`;
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
    const previous = profile.avatarKey;
    const updated = await this.prisma.creatorProfile.update({
      where: { partnerId },
      data: { avatarKey: key, avatarMime: mime },
    });
    if (previous && previous !== key) {
      try {
        await this.storage.delete(previous);
      } catch {
        /* best-effort cleanup */
      }
    }
    return this.partnerView(updated);
  }

  async directory(query: { cursor?: string; limit?: number }) {
    const limit = Math.min(
      Math.max(1, typeof query.limit === 'number' && Number.isFinite(query.limit) ? Math.floor(query.limit) : DIRECTORY_PAGE_DEFAULT),
      DIRECTORY_PAGE_MAX,
    );
    // Stable order: newest first by createdAt then id (deterministic paging; no skips/dupes).
    const rows = await this.prisma.creatorProfile.findMany({
      where: { publicActive: true, partner: { status: 'active' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    });
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1]?.id ?? null : null;
    return {
      items: page.map((row) => this.publicCard(row)),
      nextCursor,
    };
  }

  async publicProfile(idOrPartnerId: string) {
    const row =
      (await this.prisma.creatorProfile.findUnique({ where: { id: idOrPartnerId } })) ||
      (await this.prisma.creatorProfile.findUnique({ where: { partnerId: idOrPartnerId } }));
    if (!row || !row.publicActive) throw new NotFoundException('الملف غير متاح');
    const partner = await this.prisma.partner.findFirst({ where: { id: row.partnerId, status: 'active' } });
    if (!partner) throw new NotFoundException('الملف غير متاح');

    const ads = await this.prisma.catalogAd.findMany({
      where: { advertiserPartnerId: row.partnerId, status: 'published' },
      orderBy: { createdAt: 'desc' },
    });

    // Public page circles: only when this partner actually published own catalog offers.
    // Capability (canSellProducts / partner type) must not invent empty store/services orbs.
    const hasProducts = await this.prisma.product.count({
      where: { partnerId: row.partnerId, active: true, contentStatus: 'published', catalogSource: 'catalog' },
    });
    const hasServicesCount = await this.prisma.service.count({
      where: { partnerId: row.partnerId, active: true, contentStatus: 'published', catalogSource: 'catalog' },
    });

    return {
      ...this.publicCard(row),
      bioAr: row.bioAr,
      partnerId: row.partnerId,
      partnerType: partner.type,
      hasStore: hasProducts > 0,
      hasServices: hasServicesCount > 0,
      publishedAdIds: ads.map((ad) => ad.id),
      emptyAdsMessage: ads.length === 0 ? 'لا توجد إعلانات منشورة بعد' : null,
    };
  }

  async readAvatar(profileId: string): Promise<{ mimeType: string; bytes: Buffer }> {
    const row = await this.prisma.creatorProfile.findUnique({ where: { id: profileId } });
    if (!row?.avatarKey || !row.publicActive) throw new NotFoundException('الصورة غير متاحة');
    const partner = await this.prisma.partner.findFirst({ where: { id: row.partnerId, status: 'active' } });
    if (!partner) throw new NotFoundException('الصورة غير متاحة');
    try {
      const bytes = await this.storage.get(row.avatarKey);
      if (!bytes) throw new NotFoundException('الصورة غير متاحة');
      return { mimeType: row.avatarMime || 'image/jpeg', bytes };
    } catch {
      throw new NotFoundException('الصورة غير متاحة');
    }
  }

  private partnerView(row: {
    id: string;
    partnerId: string;
    displayNameAr: string;
    bioAr: string | null;
    avatarKey: string | null;
    publicActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      partnerId: row.partnerId,
      displayNameAr: row.displayNameAr,
      bioAr: row.bioAr,
      publicActive: row.publicActive,
      hasAvatar: Boolean(row.avatarKey),
      avatarUrl: row.avatarKey ? `/api/v1/marketplace/creators/${row.id}/avatar` : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      previewAsCustomer: {
        displayNameAr: row.displayNameAr,
        bioAr: row.bioAr,
        avatarUrl: row.avatarKey ? `/api/v1/marketplace/creators/${row.id}/avatar` : null,
      },
    };
  }

  private publicCard(row: {
    id: string;
    partnerId: string;
    displayNameAr: string;
    avatarKey: string | null;
  }) {
    return {
      id: row.id,
      partnerId: row.partnerId,
      displayNameAr: row.displayNameAr,
      avatarUrl: row.avatarKey ? `/api/v1/marketplace/creators/${row.id}/avatar` : null,
    };
  }

  private async requireActivePartner(partnerId: string) {
    const partner = await this.prisma.partner.findFirst({ where: { id: partnerId, status: 'active' } });
    if (!partner) throw new ForbiddenException('الحساب غير مؤهل');
  }

  private requiredText(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${label} مطلوب`);
    return value.trim().slice(0, 80);
  }

  private optionalText(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') throw new BadRequestException('النبذة يجب أن تكون نصًا');
    const t = value.trim();
    return t ? t.slice(0, 500) : null;
  }
}
