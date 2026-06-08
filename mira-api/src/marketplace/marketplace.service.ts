import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import {
  ConcernMap,
  scoreProductMatch,
  scoreServiceMatch,
} from './marketplace-matching.engine';
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
};

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
  bookingEnabled: boolean;
  concernTags: string[];
};

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
  constructor(private readonly prisma: PrismaService) {}

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

  formatPrice(halalas: number): string {
    const sar = halalas / 100;
    return `${sar.toFixed(0)} ر.س`;
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
      where: { active: true, partner: { status: 'active', type: 'brand' } },
      include: { partner: true },
    });

    const services = await this.prisma.service.findMany({
      where: {
        active: true,
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
        bookingEnabled: s.bookingEnabled,
        concernTags: s.concernTags,
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
        products: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        services: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
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
      })),
      services: partner.services.map((s) => ({
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descriptionAr: s.descriptionAr,
        durationMin: s.durationMin,
        priceLabel: this.formatPrice(s.priceHalalas),
        priceHalalas: s.priceHalalas,
        bookingEnabled: s.bookingEnabled,
        concernTags: s.concernTags,
      })),
    };
  }
}
