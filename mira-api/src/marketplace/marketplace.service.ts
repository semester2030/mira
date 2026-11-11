import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import {
  decodeCatalogCursor,
  encodeCatalogCursor,
  normalizeFilterFingerprint,
  parseCatalogLimit,
} from './catalog-cursor';
import {
  partnerCapBundleForService,
  resourceIdsForServiceDate,
  serviceHasBookableSlotOnDate,
  ACTIVE_BOOKING_STATUSES,
  type HeldInterval,
} from './catalog-availability';
import {
  branchIdFromServiceProfile,
  buildCatalogFacets,
  filterCatalogItems,
  parseCatalogFilterQuery,
  placeModeFromServiceProfile,
  type CatalogFilterItem,
  type CatalogFilterMatch,
} from './catalog-filters';
import { formatCatalogPrice } from './catalog-price';
import { localInstant } from './commerce.types';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import {
  ConcernMap,
  scoreProductMatch,
  scoreServiceMatch,
} from './marketplace-matching.engine';
import { publishedCatalogMediaWhere } from './catalog-published-media';
import { publicProductCommerce, publicServiceCommerce, sellableQty } from './commerce-public';
import { seedMarketplaceIfEmpty } from './marketplace.seed';
import { recordJourney } from './journey-events';
import { haversineKm, listSaudiCities } from '../geo/saudi-cities';

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
  private readonly taxonomy: TaxonomyService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(TaxonomyService) taxonomy?: TaxonomyService,
  ) {
    this.taxonomy = taxonomy ?? new TaxonomyService();
    if (!taxonomy) this.taxonomy.onModuleInit();
  }

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
    subcategory?: string;
    lane?: string;
    venue?: string;
    visual?: string;
    kind?: string;
    color?: string;
    size?: string;
    volume?: string;
    option?: string;
    inStock?: string;
    priceMin?: string;
    priceMax?: string;
    durationMin?: string;
    durationMax?: string;
    placeMode?: string;
    branch?: string;
    branchId?: string;
    availableOn?: string;
    sort?: string;
    facets?: string;
    /** Client search point for services distance (does not replace city filter silently). */
    nearLat?: string;
    nearLng?: string;
    ['variant.color']?: string;
    ['variant.size']?: string;
    ['variant.volume']?: string;
  }) {
    await this.ensureSeeded();
    if (params.type && !['brand', 'clinic', 'salon'].includes(params.type)) {
      throw new BadRequestException('نوع الجهة غير صالح');
    }
    const allowedLanes = new Set([
      'elegance',
      'beauty',
      'jewelry',
      'children',
      'gifts',
      'occasions',
    ]);
    if (params.lane && !allowedLanes.has(params.lane)) {
      throw new BadRequestException('المسار غير صالح');
    }
    if (params.venue && !['clinic', 'salon'].includes(params.venue)) {
      throw new BadRequestException('نوع الجهة غير صالح');
    }
    const limitParsed = parseCatalogLimit(params.limit);
    if (!limitParsed.ok) {
      throw new BadRequestException('حد الصفحة غير صالح');
    }
    const parsedLimit = limitParsed.limit;

    const parsedFilters = parseCatalogFilterQuery({
      q: params.q ?? params.hint,
      tag: params.tag,
      category: params.category,
      subcategory: params.subcategory,
      city: params.city,
      partnerId: params.partnerId,
      kind:
        params.kind ??
        (params.lane === 'elegance' ||
        params.lane === 'jewelry' ||
        params.lane === 'children' ||
        params.lane === 'gifts'
          ? 'product'
          : params.lane === 'beauty'
            ? 'service'
            : undefined),
      color: params.color,
      size: params.size,
      volume: params.volume,
      option: params.option,
      inStock: params.inStock,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      durationMin: params.durationMin,
      durationMax: params.durationMax,
      placeMode: params.placeMode,
      branch: params.branch,
      branchId: params.branchId,
      availableOn: params.availableOn,
      sort: params.sort,
      metal: (params as any).metal,
      purity: (params as any).purity,
      giftEligible: (params as any).giftEligible,
      ageMonths: (params as any).ageMonths,
      lane: params.lane,
      'variant.color': params['variant.color'] ?? params.color,
      'variant.size': params['variant.size'] ?? params.size,
      'variant.volume': params['variant.volume'] ?? params.volume,
      'variant.ringSize': (params as any)['variant.ringSize'],
    });
    if (!parsedFilters.ok) {
      throw new BadRequestException(parsedFilters.messageAr);
    }
    const filter = parsedFilters.filter;
    // Enrich subcategory with central taxonomy so service leaves (occasions.styling) match services.
    if (filter.subcategory) {
      const node = this.taxonomy.resolveCatalogSubcategory(filter.subcategory);
      if (node) filter.taxonomyNode = node;
    }
    // City is applied in-memory so city facets can exclude the city filter itself (C03).
    const fingerprint = normalizeFilterFingerprint(filter, {
      type: params.type,
      venue: params.venue,
      visual: params.visual,
      lane: params.lane,
    });
    const sort = filter.sort ?? 'key';
    const decodedCursor = decodeCatalogCursor(params.cursor, { sort, fingerprint });
    if (!decodedCursor.ok) {
      throw new BadRequestException(
        decodedCursor.reason === 'cursor_mismatch'
          ? 'مؤشر الصفحة لا يطابق البحث الحالي'
          : 'مؤشر الصفحة غير صالح',
      );
    }

    const partnerBase = {
      status: 'active' as const,
      ...(params.partnerId ? { id: params.partnerId } : {}),
    };
    const productPartner = params.lane === 'beauty'
      ? { ...partnerBase, id: '__none__' }
      : params.type
      ? params.type === 'brand'
        ? { ...partnerBase, OR: [{ type: 'brand' }, { type: 'developer' }] }
        : { ...partnerBase, type: params.type }
      : params.lane === 'elegance' ||
          params.lane === 'jewelry' ||
          params.lane === 'children' ||
          params.lane === 'gifts' ||
          params.lane === 'occasions'
        ? {
            ...partnerBase,
            OR: [{ type: 'brand' }, { type: 'developer' }, { type: 'event_planner' }],
          }
        : partnerBase;
    const servicePartner = params.lane === 'elegance' ||
      params.lane === 'jewelry' ||
      params.lane === 'children' ||
      params.lane === 'gifts'
      ? { ...partnerBase, id: '__none__' }
      : params.venue
        ? { ...partnerBase, type: params.venue }
        : params.type
      ? params.type === 'clinic' || params.type === 'salon' || params.type === 'event_planner'
        ? { ...partnerBase, OR: [{ type: params.type }, { type: 'developer' }] }
        : { ...partnerBase, type: params.type }
      : params.lane === 'beauty' || params.lane === 'occasions'
        ? {
            ...partnerBase,
            OR: [{ type: 'clinic' }, { type: 'salon' }, { type: 'event_planner' }, { type: 'developer' }],
          }
        : partnerBase;

    const needVariantInventory =
      filter.inStock != null || Object.keys(filter.variantSelections ?? {}).length > 0 || params.facets === '1';

    // Published catalog only; cities derived from these rows (no extra partner scan).
    // Kind is pushed to SQL via impossible id when the other kind is requested (C06 partial).
    // Variant AND/OR, city/branch facets, and availability stay in-process for facet accuracy.
    const subNode = filter.taxonomyNode;
    const subcategoryIsService = subNode?.offerKind === 'service';
    const subcategoryIsProduct = !subcategoryIsService && !!filter.subcategory;
    const [products, services] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          partner: productPartner,
          ...(filter.kind === 'service' || subcategoryIsService ? { id: '__none__' } : {}),
          // Push product subcategory to SQL only for product leaves (E1-11).
          ...(subcategoryIsProduct ? { subcategory: filter.subcategory } : {}),
          ...(params.lane === 'occasions' && !filter.subcategory && !filter.category
            ? {
                OR: [
                  { category: 'occasions' },
                  { subcategory: { startsWith: 'occasions.' } },
                ],
              }
            : {}),
        },
        include: {
          partner: true,
          ...(needVariantInventory
            ? {
                variantInventories: {
                  where: { archivedAt: null },
                  select: { variantId: true, stockQty: true, reservedQty: true, stockMode: true },
                },
              }
            : {}),
        },
      }),
      this.prisma.service.findMany({
        where: {
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          partner: servicePartner,
          ...(filter.kind === 'product' || subcategoryIsProduct ? { id: '__none__' } : {}),
          // Service leaves / occasions lane: scope by taxonomy category id, never partner type alone.
          ...(subcategoryIsService && subNode?.category ? { category: subNode.category } : {}),
          ...(params.lane === 'occasions' && !filter.subcategory && !filter.category
            ? { category: 'occasions' }
            : {}),
        },
        include: { partner: true, branch: true },
      }),
    ]);
    const nearLat = params.nearLat != null && params.nearLat !== '' ? Number(params.nearLat) : NaN;
    const nearLng = params.nearLng != null && params.nearLng !== '' ? Number(params.nearLng) : NaN;
    const hasNear =
      Number.isFinite(nearLat) &&
      Number.isFinite(nearLng) &&
      nearLat >= -90 &&
      nearLat <= 90 &&
      nearLng >= -180 &&
      nearLng <= 180;
    if ((params.nearLat || params.nearLng) && !hasNear) {
      throw new BadRequestException('إحداثيات البحث غير صالحة');
    }
    if (filter.sort === 'distance' && !hasNear) {
      throw new BadRequestException('ترتيب الأقرب يتطلب موقع بحث صالحًا');
    }

    type ProductRow = (typeof products)[number] & {
      variantInventories?: Array<{ variantId: string; stockQty: number | null; reservedQty: number; stockMode: string }>;
    };

    // Bookability is service-level for the date (holds/capacity/duration/bookingEnabled).
    // Branch filter is applied later in matchCatalogItem so branch facets can exclude
    // the branch field itself while keeping availableOn (P5 remaining review).
    const bookableByServiceId = filter.availableOn
      ? await this.computeBookableServiceIds(
          services.map((s) => ({
            id: s.id,
            partnerId: s.partnerId,
            bookingEnabled: s.bookingEnabled,
            durationMin: s.durationMin,
            availabilityJson: s.availabilityJson,
            branchId: branchIdFromServiceProfile(s.serviceProfileJson),
          })),
          filter.availableOn,
        )
      : null;

    const filterItems: CatalogFilterItem[] = [
      ...products.map((product) => {
        const row = product as ProductRow;
        const commerce = publicProductCommerce(product);
        const variantSellable: Record<string, number | null> = {};
        for (const inv of row.variantInventories ?? []) {
          if (inv.stockMode === 'untracked') {
            variantSellable[inv.variantId] = null;
          } else {
            variantSellable[inv.variantId] = sellableQty({ stockQty: inv.stockQty, reservedQty: inv.reservedQty });
          }
        }
        return {
          kind: 'product' as const,
          id: product.id,
          partnerId: product.partnerId,
          partnerType: product.partner.type,
          partnerNameAr: product.partner.nameAr,
          city: product.partner.city,
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          descriptionAr: product.descriptionAr,
          category: product.category,
          subcategory: product.subcategory,
          profileId: (product as { profileId?: string | null }).profileId ?? null,
          concernTags: product.concernTags,
          priceHalalas: product.priceHalalas,
          optionsJson: commerce.optionsJson,
          variantsJson: commerce.variantsJson,
          attributesJson:
            product.attributesJson &&
            typeof product.attributesJson === 'object' &&
            !Array.isArray(product.attributesJson)
              ? (product.attributesJson as Record<string, unknown>)
              : null,
          stockQty: commerce.stockQty,
          stockAvailable: commerce.stockAvailable,
          inventoryMode: product.inventoryMode,
          variantSellable: Object.keys(variantSellable).length ? variantSellable : undefined,
        };
      }),
      ...services.map((service) => {
        const profileBranchId = branchIdFromServiceProfile(service.serviceProfileJson);
        const branchId = service.branchId || profileBranchId;
        const placeMode =
          (typeof service.placeMode === 'string' && service.placeMode.trim()) ||
          placeModeFromServiceProfile(service.serviceProfileJson);
        const branch = service.branch;
        const lat = branch && Number.isFinite(branch.lat) ? branch.lat : null;
        const lng = branch && Number.isFinite(branch.lng) ? branch.lng : null;
        let coverageCityIds: string[] | null = null;
        if (service.coverageJson && typeof service.coverageJson === 'object' && !Array.isArray(service.coverageJson)) {
          const raw = (service.coverageJson as { cityIds?: unknown }).cityIds;
          if (Array.isArray(raw)) {
            coverageCityIds = raw.filter((x): x is string => typeof x === 'string' && !!x.trim());
          }
        }
        let distanceKm: number | null = null;
        // Remote services never enter distance ranking; home uses coverage cities, not HQ proximity alone.
        if (placeMode === 'remote') {
          distanceKm = null;
        } else if (placeMode === 'home') {
          distanceKm = null;
        } else if (hasNear && lat != null && lng != null) {
          distanceKm = Math.round(haversineKm(nearLat, nearLng, lat, lng) * 10) / 10;
        }
        const availableOnDay =
          filter.availableOn == null
            ? null
            : bookableByServiceId?.has(service.id) === true;
        const attrsRaw = (service as { attributesJson?: unknown }).attributesJson;
        return {
          kind: 'service' as const,
          id: service.id,
          partnerId: service.partnerId,
          partnerType: service.partner.type,
          partnerNameAr: service.partner.nameAr,
          city: (branch && branch.cityNameAr) || service.partner.city,
          nameAr: service.nameAr,
          nameEn: service.nameEn,
          descriptionAr: service.descriptionAr,
          category: service.category,
          profileId: service.profileId ?? null,
          concernTags: service.concernTags,
          priceHalalas: service.priceHalalas,
          durationMin: service.durationMin,
          placeMode,
          branchId,
          lat,
          lng,
          distanceKm,
          coverageCityIds,
          availabilityJson: service.availabilityJson,
          bookingEnabled: service.bookingEnabled,
          availableOnDay,
          attributesJson:
            attrsRaw && typeof attrsRaw === 'object' && !Array.isArray(attrsRaw)
              ? (attrsRaw as Record<string, unknown>)
              : null,
        };
      }),
    ];

    const requireVisual = params.visual === '1';
    const visualOwnerOr = [
      ...products.map((p) => ({ ownerKind: 'product' as const, ownerId: p.id })),
      ...services.map((s) => ({ ownerKind: 'service' as const, ownerId: s.id })),
    ];
    const visualKeys =
      requireVisual && visualOwnerOr.length > 0
        ? new Set(
            (
              await this.prisma.catalogMedia.findMany({
                where: {
                  active: true,
                  publication: 'published',
                  pendingRemoval: false,
                  kind: { in: ['image', 'video'] },
                  OR: visualOwnerOr,
                },
                select: { ownerKind: true, ownerId: true },
              })
            ).map((row) => `${row.ownerKind}:${row.ownerId}`),
          )
        : requireVisual
          ? new Set<string>()
          : null;

    const scoped = filterItems.filter((item) => {
      if (params.lane === 'elegance' && item.kind !== 'product') return false;
      if (params.lane === 'beauty' && item.kind !== 'service') return false;
      if (params.venue && item.partnerType !== params.venue) return false;
      if (visualKeys && !visualKeys.has(`${item.kind}:${item.id}`)) return false;
      return true;
    });

    const matched = filterCatalogItems(scoped, filter);
    const facets = params.facets === '1' ? buildCatalogFacets(scoped, filter) : undefined;

    // Unified paging for all sorts — cursor is bound to fingerprint+sort.
    let start = 0;
    if (decodedCursor.ok && decodedCursor.id) {
      const idx = matched.findIndex(
        (m) => m.item.kind === decodedCursor.kind && m.item.id === decodedCursor.id,
      );
      if (idx < 0) {
        throw new BadRequestException('مؤشر الصفحة غير صالح');
      }
      start = idx + 1;
    }
    const pagedItems: CatalogFilterMatch[] = matched.slice(start, start + parsedLimit);
    const last = pagedItems[pagedItems.length - 1];
    const nextCursor =
      last && start + pagedItems.length < matched.length
        ? encodeCatalogCursor({
            sort,
            fingerprint,
            kind: last.item.kind,
            id: last.item.id,
          })
        : null;

    const productById = new Map(products.map((p) => [p.id, p]));
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const media = pagedItems.length
      ? await this.prisma.catalogMedia.findMany({
          where: {
            active: true,
            publication: 'published',
            OR: pagedItems.map((m) => ({ ownerKind: m.item.kind, ownerId: m.item.id })),
          },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    const cities = [
      ...new Set(
        [...products, ...services]
          .map((row) => row.partner.city)
          .filter((city) => typeof city === 'string' && city.length > 0),
      ),
    ].sort();

    return {
      items: pagedItems.map((match) => {
        const item = match.item;
        if (item.kind === 'product') {
          const product = productById.get(item.id)!;
          const commerce = publicProductCommerce(product);
          const prices = match.matchedVariants
            .map((v) => v.priceHalalas)
            .filter((p): p is number => p != null);
          const uniquePrices = [...new Set(prices)];
          // Representative price is always the minimum known eligible/matched price.
          // Sort direction must not change priceHalalas or priceLabel (C03).
          const displayPrice =
            match.matchedVariants.length === 1
              ? match.matchedVariants[0]!.priceHalalas
              : match.effectivePriceHalalas ?? product.priceHalalas;
          const priceLabel =
            uniquePrices.length > 1
              ? `ابتداءً من ${this.formatPrice(Math.min(...uniquePrices))}`
              : this.formatPrice(displayPrice);
          return {
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
            priceHalalas: displayPrice,
            priceLabel,
            externalUrl: product.externalUrl,
            stepAr: product.stepAr,
            partnerEmoji: product.partner.logoEmoji,
            concernTags: product.concernTags,
            category: product.category,
            subcategory: product.subcategory,
            profileId: product.profileId,
            durationMin: null as number | null,
            ...commerce,
            bookingEnabled: false,
            payMode: null as string | null,
            availabilityPresent: false,
            matchedVariantIds: match.matchedVariants.map((v) => v.variantId),
            matchedVariants: match.matchedVariants,
            media: media
              .filter((row) => row.ownerKind === 'product' && row.ownerId === product.id)
              .map((row) => ({
                kind: row.kind,
                url: row.url,
                sortOrder: row.sortOrder,
                isPrimary: row.isPrimary,
                placement: row.placement,
              })),
          };
        }
        const service = serviceById.get(item.id)!;
        return {
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
          placeMode: item.placeMode,
          branchId: item.branchId,
          distanceKm: item.distanceKm ?? null,
          distanceLabelAr:
            item.distanceKm != null
              ? `تقريبًا ${item.distanceKm} كم`
              : item.placeMode === 'remote'
                ? 'عن بُعد — بلا ترتيب مسافة'
                : item.placeMode === 'home'
                  ? 'منزلي — حسب التغطية'
                  : null,
          matchedVariantIds: [] as string[],
          matchedVariants: [] as CatalogFilterMatch['matchedVariants'],
          media: media
            .filter((row) => row.ownerKind === 'service' && row.ownerId === service.id)
            .map((row) => ({
              kind: row.kind,
              url: row.url,
              sortOrder: row.sortOrder,
              isPrimary: row.isPrimary,
              placement: row.placement,
            })),
        };
      }),
      nextCursor,
      availableCities: cities,
      saudiCities: listSaudiCities(),
      totalMatched: matched.length,
      queryFingerprint: fingerprint,
      activeFilters: {
        q: filter.q ?? null,
        tags: filter.tags ?? [],
        category: filter.category ?? null,
        city: filter.city ?? null,
        partnerId: filter.partnerId ?? null,
        kind: filter.kind ?? null,
        variantSelections: filter.variantSelections ?? {},
        inStock: filter.inStock ?? null,
        priceMinHalalas: filter.priceMinHalalas ?? null,
        priceMaxHalalas: filter.priceMaxHalalas ?? null,
        durationMin: filter.durationMin ?? null,
        durationMax: filter.durationMax ?? null,
        placeModes: filter.placeModes ?? [],
        branchIds: filter.branchIds ?? [],
        availableOn: filter.availableOn ?? null,
        sort,
      },
      ...(facets ? { facets } : {}),
    };
  }

  /**
   * Batch bookability for availableOn: one sibling-cap load per partner + one holds query for the day.
   * Uses the same buildDaySlots rules as CommerceService.serviceAvailability (no second algorithm).
   */
  private async computeBookableServiceIds(
    services: Array<{
      id: string;
      partnerId: string;
      bookingEnabled: boolean;
      durationMin: number;
      availabilityJson: unknown;
      branchId: string | null;
    }>,
    dateKey: string,
  ): Promise<Set<string>> {
    const bookable = new Set<string>();
    if (!localInstant(dateKey, 0) || services.length === 0) return bookable;

    const partnerIds = [...new Set(services.map((s) => s.partnerId))];
    const siblings = await this.prisma.service.findMany({
      where: { partnerId: { in: partnerIds }, active: true },
      select: { partnerId: true, availabilityJson: true },
    });
    const siblingJsonByPartner = new Map<string, unknown[]>();
    for (const row of siblings) {
      const list = siblingJsonByPartner.get(row.partnerId) ?? [];
      list.push(row.availabilityJson);
      siblingJsonByPartner.set(row.partnerId, list);
    }

    const dayStart = localInstant(dateKey, 0)!;
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const bundles = new Map<string, ReturnType<typeof partnerCapBundleForService>>();
    const allResourceIds = new Set<string>();
    for (const service of services) {
      const bundle = partnerCapBundleForService(
        service.availabilityJson,
        siblingJsonByPartner.get(service.partnerId) ?? [service.availabilityJson],
      );
      bundles.set(service.id, bundle);
      for (const id of resourceIdsForServiceDate(
        service.availabilityJson,
        bundle.calendar,
        dateKey,
        bundle.windows,
      )) {
        allResourceIds.add(id);
      }
    }

    const heldRows = await this.prisma.commerceBooking.findMany({
      where: {
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        OR: [
          { serviceId: { in: services.map((s) => s.id) }, resourceId: '' },
          ...(allResourceIds.size
            ? [{ partnerId: { in: partnerIds }, resourceId: { in: [...allResourceIds] } }]
            : []),
        ],
      },
      select: { serviceId: true, partnerId: true, startsAt: true, endsAt: true, resourceId: true },
    });

    const now = new Date();
    for (const service of services) {
      const bundle = bundles.get(service.id)!;
      const serviceResourceIds = new Set(
        resourceIdsForServiceDate(service.availabilityJson, bundle.calendar, dateKey, bundle.windows),
      );
      const held: HeldInterval[] = heldRows
        .filter((h) => {
          if (h.resourceId === '' && h.serviceId === service.id) return true;
          return h.partnerId === service.partnerId && serviceResourceIds.has(h.resourceId);
        })
        .map((h) => ({ startsAt: h.startsAt, endsAt: h.endsAt, resourceId: h.resourceId }));
      if (
        serviceHasBookableSlotOnDate({
          service,
          dateKey,
          bundle,
          held,
          now,
        })
      ) {
        bookable.add(service.id);
      }
    }
    return bookable;
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
        media: media.map((row) => ({ kind: row.kind, url: row.url, sortOrder: row.sortOrder, isPrimary: row.isPrimary, placement: row.placement })),
      };
    }
    const service = await this.prisma.service.findFirst({
      where: { id, active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } },
      include: { partner: true },
    });
    if (!service) throw new NotFoundException('العنصر غير متاح');
    await recordJourney({ name: 'service_viewed', kind: 'service', subjectId: service.id }, this.prisma);
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
      // Approved profile only — never draft_service_profile_json.
      serviceProfileJson: service.serviceProfileJson ?? null,
      media: media.map((row) => ({ kind: row.kind, url: row.url, sortOrder: row.sortOrder, isPrimary: row.isPrimary, placement: row.placement })),
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
