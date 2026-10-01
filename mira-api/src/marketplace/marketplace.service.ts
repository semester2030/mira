import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compareCatalogKeys, pageCatalogItems } from './catalog-page';
import { formatCatalogPrice } from './catalog-price';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import {
  ConcernMap,
  scoreProductMatch,
  scoreServiceMatch,
} from './marketplace-matching.engine';
import { publishedCatalogMediaWhere } from './catalog-published-media';
import { publicProductCommerce, publicServiceCommerce } from './commerce-public';
import { seedMarketplaceIfEmpty } from './marketplace.seed';

export type MatchedProductDto = {
  id: string;
  partnerId: string;
  partnerNameAr: string;
  partnerEmoji: string | null;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  priceHalalas: number;
  priceLabel: string;
  externalUrl: string;
  stepAr: string | null;
  matchScore: number;
  concernTags: string[];
} & ReturnType<typeof publicProductCommerce>;

export type MatchedServiceDto = {
  id: string;
  partnerId: string;
  partnerNameAr: string;
  partnerEmoji: string | null;
  partnerType: string;
  city: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  durationMin: number;
  priceHalalas: number;
  priceLabel: string;
  matchScore: number;
  concernTags: string[];
} & ReturnType<typeof publicServiceCommerce>;

export type PartnerSummaryDto = {
  id: string;
  type: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  city: string;
  logoEmoji: string | null;
  rating: number;
  storeUrl: string | null;
};

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await seedMarketplaceIfEmpty(this.prisma);
    } catch (e) {
      // DB may be unavailable in some dev setups — catalog seeds on first request.
      console.warn('Marketplace seed skipped:', String(e));
    }
  }

  private async ensureSeeded(): Promise<void> {
    await seedMarketplaceIfEmpty(this.prisma);
  }

  formatPrice(halalas: number | null | undefined): string {
    return formatCatalogPrice(halalas) ?? '';
  }

  buildConcernMap(dto: MatchMarketplaceDto): ConcernMap {
    const map: ConcernMap = { ...(dto.concernScores ?? {}) };
    if (dto.hydration != null) map.moisture = dto.hydration;
    if (dto.oiliness != null) map.oiliness = 100 - dto.oiliness;
    return map;
  }

  async match(dto: MatchMarketplaceDto) {
    await this.ensureSeeded();
    const concerns = this.buildConcernMap(dto);
    const skinTypeAr = dto.skinTypeAr ?? 'مختلطة';
    const city = dto.city ?? 'الرياض';

    const products = await this.prisma.product.findMany({
      where: { active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active', type: 'brand' } },
      include: { partner: true },
    });

    const services = await this.prisma.service.findMany({
      where: {
        active: true,
        contentStatus: 'published', catalogSource: 'catalog',
        partner: {
          status: 'active',
          type: { in: ['clinic', 'salon'] },
          ...(city ? { city } : {}),
        },
      },
      include: { partner: true },
    });

    const matchedProducts: MatchedProductDto[] = products
      .map((p) => ({
        id: p.id,
        partnerId: p.partnerId,
        partnerNameAr: p.partner.nameAr,
        partnerEmoji: p.partner.logoEmoji,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: p.descriptionAr,
        priceHalalas: p.priceHalalas,
        priceLabel: this.formatPrice(p.priceHalalas),
        externalUrl: p.externalUrl,
        stepAr: p.stepAr,
        matchScore: scoreProductMatch(
          p.concernTags,
          p.skinTypes,
          concerns,
          skinTypeAr,
          dto.undertoneEn,
          dto.userAge,
        ),
        concernTags: p.concernTags,
        ...publicProductCommerce(p),
      }))
      .filter((p) => p.matchScore >= 35)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 12);

    const matchedServices: MatchedServiceDto[] = services
      .map((s) => ({
        id: s.id,
        partnerId: s.partnerId,
        partnerNameAr: s.partner.nameAr,
        partnerEmoji: s.partner.logoEmoji,
        partnerType: s.partner.type,
        city: s.partner.city,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descriptionAr: s.descriptionAr,
        durationMin: s.durationMin,
        priceHalalas: s.priceHalalas,
        priceLabel: this.formatPrice(s.priceHalalas),
        matchScore: scoreServiceMatch(s.concernTags, concerns),
        concernTags: s.concernTags,
        ...publicServiceCommerce(s),
      }))
      .filter((s) => s.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);

    return {
      products: matchedProducts,
      services: matchedServices,
      meta: {
        skinTypeAr,
        city,
        productCount: matchedProducts.length,
        serviceCount: matchedServices.length,
      },
    };
  }

  async browse(params: {
    q?: string;
    type?: string;
    city?: string;
    tag?: string;
    hint?: string;
    cursor?: string;
    limit?: string;
    partnerId?: string;
    category?: string;
    lane?: string;
    venue?: string;
    visual?: string;
  }) {
    await this.ensureSeeded();
    if (params.type && !['brand', 'clinic', 'salon'].includes(params.type)) {
      throw new BadRequestException('نوع الجهة غير صالح');
    }
    if (params.lane && !['elegance', 'beauty'].includes(params.lane)) {
      throw new BadRequestException('المسار غير صالح');
    }
    if (params.venue && !['clinic', 'salon'].includes(params.venue)) {
      throw new BadRequestException('نوع الجهة غير صالح');
    }
    const parsedLimit = params.limit == null || params.limit === '' ? 8 : Number(params.limit);
    if (!Number.isInteger(parsedLimit)) {
      throw new BadRequestException('حد الصفحة غير صالح');
    }
    const tags = (params.tag ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const hint = (params.hint ?? '').trim().toLowerCase();
    const q = (params.q ?? '').trim().toLowerCase();
    const partnerBase = {
      status: 'active' as const,
      ...(params.city ? { city: params.city } : {}),
      ...(params.partnerId ? { id: params.partnerId } : {}),
    };
    const productPartner = params.lane === 'beauty'
      ? { ...partnerBase, id: '__none__' }
      : params.type
      ? params.type === 'brand'
        ? { ...partnerBase, OR: [{ type: 'brand' }, { type: 'developer' }] }
        : { ...partnerBase, type: params.type }
      : params.lane === 'elegance'
        ? { ...partnerBase, OR: [{ type: 'brand' }, { type: 'developer' }] }
        : partnerBase;
    const servicePartner = params.lane === 'elegance'
      ? { ...partnerBase, id: '__none__' }
      : params.venue
        ? { ...partnerBase, type: params.venue }
        : params.type
      ? params.type === 'clinic' || params.type === 'salon'
        ? { ...partnerBase, OR: [{ type: params.type }, { type: 'developer' }] }
        : { ...partnerBase, type: params.type }
      : params.lane === 'beauty'
        ? { ...partnerBase, OR: [{ type: 'clinic' }, { type: 'salon' }, { type: 'developer' }] }
        : partnerBase;

    const [products, services, partners] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true, contentStatus: 'published', catalogSource: 'catalog', partner: productPartner },
        include: { partner: true },
      }),
      this.prisma.service.findMany({
        where: { active: true, contentStatus: 'published', catalogSource: 'catalog', partner: servicePartner },
        include: { partner: true },
      }),
      this.prisma.partner.findMany({
        where: { status: 'active' },
        select: { city: true },
      }),
    ]);

    const items = [
      ...products.map((product) => ({
        kind: 'product' as const,
        id: product.id,
        partnerId: product.partnerId,
        partnerType: product.partner.type,
        partnerNameAr: product.partner.nameAr,
        city: product.partner.city,
        contactPhone: product.partner.contactPhone,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        descriptionAr: product.descriptionAr,
        priceHalalas: product.priceHalalas,
        priceLabel: this.formatPrice(product.priceHalalas),
        externalUrl: product.externalUrl,
        stepAr: product.stepAr,
        partnerEmoji: product.partner.logoEmoji,
        concernTags: product.concernTags,
        category: product.category,
        durationMin: null as number | null,
        ...publicProductCommerce(product),
        bookingEnabled: false,
        payMode: null as string | null,
        availabilityPresent: false,
      })),
      ...services.map((service) => ({
        kind: 'service' as const,
        id: service.id,
        partnerId: service.partnerId,
        partnerType: service.partner.type,
        partnerNameAr: service.partner.nameAr,
        city: service.partner.city,
        contactPhone: service.partner.contactPhone,
        nameAr: service.nameAr,
        nameEn: service.nameEn,
        descriptionAr: service.descriptionAr,
        priceHalalas: service.priceHalalas,
        priceLabel: this.formatPrice(service.priceHalalas),
        externalUrl: null as string | null,
        stepAr: null as string | null,
        partnerEmoji: service.partner.logoEmoji,
        concernTags: service.concernTags,
        category: service.category,
        durationMin: service.durationMin,
        ...publicServiceCommerce(service),
        purchaseMode: null as string | null,
        stockQty: null as number | null,
        stockAvailable: false,
        deliveryFeeHalalas: null as number | null,
        optionsJson: null as unknown,
        variantsJson: null as unknown,
      })),
    ].sort((a, b) => compareCatalogKeys(`${a.kind}:${a.id}`, `${b.kind}:${b.id}`));

    const category = (params.category ?? '').trim();
    const requireVisual = params.visual === '1';
    const visualKeys = requireVisual
      ? new Set(
          (
            await this.prisma.catalogMedia.findMany({
              where: {
                active: true,
                publication: 'published',
                pendingRemoval: false,
                kind: { in: ['image', 'video'] },
              },
              select: { ownerKind: true, ownerId: true },
            })
          ).map((row) => `${row.ownerKind}:${row.ownerId}`),
        )
      : null;
    const matched = items.filter((item) => {
      if (params.lane === 'elegance' && item.kind !== 'product') return false;
      if (params.lane === 'beauty' && item.kind !== 'service') return false;
      if (params.venue && item.partnerType !== params.venue) return false;
      if (visualKeys && !visualKeys.has(`${item.kind}:${item.id}`)) return false;
      if (category && item.category !== category) return false;
      if (tags.length > 0 && !item.concernTags.some((tag) => tags.includes(tag))) return false;
      if (hint && !`${item.nameAr} ${item.nameEn}`.toLowerCase().includes(hint)) return false;
      if (!q) return true;
      const haystack = `${item.nameAr} ${item.nameEn} ${item.partnerNameAr} ${item.descriptionAr ?? ''} ${item.city}`.toLowerCase();
      return haystack.includes(q);
    });

    const paged = pageCatalogItems(matched, params.cursor, parsedLimit);
    if (!paged.ok) {
      throw new BadRequestException(paged.reason === 'invalid_cursor' ? 'مؤشر الصفحة غير صالح' : 'حد الصفحة غير صالح');
    }
    const media = paged.items.length
      ? await this.prisma.catalogMedia.findMany({
          where: {
            active: true,
            publication: 'published',
            OR: paged.items.map((item) => ({ ownerKind: item.kind, ownerId: item.id })),
          },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    const cities = [...new Set(partners.map((partner) => partner.city).filter((city) => city.length > 0))].sort();
    return {
      items: paged.items.map((item) => ({
        ...item,
        media: media
          .filter((row) => row.ownerKind === item.kind && row.ownerId === item.id)
          .map((row) => ({ kind: row.kind, url: row.url, sortOrder: row.sortOrder, isPrimary: row.isPrimary })),
      })),
      nextCursor: paged.nextCursor,
      availableCities: cities,
    };
  }

  async listPartners(type?: string, city?: string): Promise<PartnerSummaryDto[]> {
    await this.ensureSeeded();
    const partners = await this.prisma.partner.findMany({
      where: {
        status: 'active',
        ...(type ? { type } : {}),
        ...(city ? { city } : {}),
      },
      orderBy: { rating: 'desc' },
    });

    return partners.map((p) => ({
      id: p.id,
      type: p.type,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      city: p.city,
      logoEmoji: p.logoEmoji,
      rating: p.rating,
      storeUrl: p.storeUrl,
    }));
  }

  async getPartner(id: string) {
    await this.ensureSeeded();
    const partner = await this.prisma.partner.findFirst({
      where: { id, status: 'active' },
      include: {
        products: { where: { active: true, contentStatus: 'published', catalogSource: 'catalog' }, orderBy: { sortOrder: 'asc' } },
        services: { where: { active: true, contentStatus: 'published', catalogSource: 'catalog' }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!partner) throw new NotFoundException('الشريك غير موجود');

    return {
      id: partner.id,
      type: partner.type,
      nameAr: partner.nameAr,
      nameEn: partner.nameEn,
      descriptionAr: partner.descriptionAr,
      city: partner.city,
      logoEmoji: partner.logoEmoji,
      rating: partner.rating,
      storeUrl: partner.storeUrl,
      contactPhone: partner.contactPhone,
      products: partner.products.map((p) => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: p.descriptionAr,
        priceLabel: this.formatPrice(p.priceHalalas),
        priceHalalas: p.priceHalalas,
        externalUrl: p.externalUrl,
        stepAr: p.stepAr,
        concernTags: p.concernTags,
        category: p.category,
        ...publicProductCommerce(p),
      })),
      services: partner.services.map((s) => ({
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descriptionAr: s.descriptionAr,
        durationMin: s.durationMin,
        priceLabel: this.formatPrice(s.priceHalalas),
        priceHalalas: s.priceHalalas,
        concernTags: s.concernTags,
        category: s.category,
        ...publicServiceCommerce(s),
      })),
    };
  }

  async getPublishedItem(kind: string, id: string) {
    await this.ensureSeeded();
    if (kind !== 'product' && kind !== 'service') throw new BadRequestException('نوع العنصر غير صالح');
    if (kind === 'product') {
      const product = await this.prisma.product.findFirst({
        where: { id, active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } },
        include: { partner: true },
      });
      if (!product) throw new NotFoundException('العنصر غير متاح');
      const media = await this.prisma.catalogMedia.findMany({
        where: publishedCatalogMediaWhere('product', product.id),
        orderBy: { sortOrder: 'asc' },
      });
      return {
        kind: 'product',
        id: product.id,
        partnerId: product.partnerId,
        partnerType: product.partner.type,
        partnerNameAr: product.partner.nameAr,
        city: product.partner.city,
        contactPhone: product.partner.contactPhone,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        descriptionAr: product.descriptionAr,
        priceHalalas: product.priceHalalas,
        priceLabel: this.formatPrice(product.priceHalalas),
        externalUrl: product.externalUrl,
        category: product.category,
        concernTags: product.concernTags,
        ...publicProductCommerce(product),
        media: media.map((row) => ({ kind: row.kind, url: row.url, sortOrder: row.sortOrder, isPrimary: row.isPrimary })),
      };
    }
    const service = await this.prisma.service.findFirst({
      where: { id, active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } },
      include: { partner: true },
    });
    if (!service) throw new NotFoundException('العنصر غير متاح');
    const media = await this.prisma.catalogMedia.findMany({
      where: publishedCatalogMediaWhere('service', service.id),
      orderBy: { sortOrder: 'asc' },
    });
    return {
      kind: 'service',
      id: service.id,
      partnerId: service.partnerId,
      partnerType: service.partner.type,
      partnerNameAr: service.partner.nameAr,
      partnerEmoji: service.partner.logoEmoji,
      city: service.partner.city,
      contactPhone: service.partner.contactPhone,
      nameAr: service.nameAr,
      nameEn: service.nameEn,
      descriptionAr: service.descriptionAr,
      durationMin: service.durationMin,
      priceHalalas: service.priceHalalas,
      priceLabel: this.formatPrice(service.priceHalalas),
      category: service.category,
      concernTags: service.concernTags,
      ...publicServiceCommerce(service),
      media: media.map((row) => ({ kind: row.kind, url: row.url, sortOrder: row.sortOrder, isPrimary: row.isPrimary })),
    };
  }

  async listFavorites(firebaseUid: string) {
    const user = await this.requireUser(firebaseUid);
    const rows = await this.prisma.catalogFavorite.findMany({ where: { userId: user.id } });
    return { items: rows.map((row) => ({ kind: row.ownerKind, id: row.ownerId })) };
  }

  async setFavorite(firebaseUid: string, kind: string, entityId: string, saved: boolean | undefined) {
    if (saved !== true && saved !== false) throw new BadRequestException('حالة الحفظ مطلوبة');
    if (kind !== 'product' && kind !== 'service') throw new BadRequestException('نوع العنصر غير صالح');
    const user = await this.requireUser(firebaseUid);
    await this.getPublishedItem(kind, entityId);
    const where = { userId_ownerKind_ownerId: { userId: user.id, ownerKind: kind, ownerId: entityId } };
    if (saved) {
      try {
        await this.prisma.catalogFavorite.upsert({
          where,
          create: { userId: user.id, ownerKind: kind, ownerId: entityId },
          update: {},
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
      return { saved: true };
    }
    await this.prisma.catalogFavorite.deleteMany({
      where: { userId: user.id, ownerKind: kind, ownerId: entityId },
    });
    return { saved: false };
  }

  private async requireUser(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new UnauthorizedException('يلزم حساب ميرا');
    return user;
  }
}
