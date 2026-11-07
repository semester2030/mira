import { BadRequestException, Body, Controller, Get, Inject, Optional, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { coerceQueryParam } from './catalog-filters';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import { MarketplaceService } from './marketplace.service';
import { listSaudiCities } from '../geo/saudi-cities';
import { TaxonomyService } from './taxonomy/taxonomy.service';

function qstr(raw: unknown): string | undefined {
  return coerceQueryParam(raw);
}

/** Public catalog + skin-based matching (no auth — no PII in request). */
@Controller('marketplace')
export class MarketplaceController {
  private readonly taxonomy: TaxonomyService;

  constructor(
    @Inject(MarketplaceService) private readonly marketplace: MarketplaceService,
    @Optional() @Inject(TaxonomyService) taxonomy?: TaxonomyService,
  ) {
    this.taxonomy = taxonomy ?? new TaxonomyService();
    if (!taxonomy) this.taxonomy.onModuleInit();
  }

  @Post('match')
  match(@Body() dto: MatchMarketplaceDto) {
    return this.marketplace.match(dto);
  }

  /** Public elegance taxonomy projection (derived; no partner auth). */
  @Get('taxonomy')
  getTaxonomy(@Query('lane') lane?: string) {
    const laneId = (lane ?? 'elegance').trim();
    if (laneId !== 'elegance') {
      throw new BadRequestException({
        message: 'مسار التصنيفات غير مدعوم',
        messageAr: 'مسار التصنيفات غير مدعوم',
        code: 'TAXONOMY_LANE_UNSUPPORTED',
      });
    }
    return this.taxonomy.publicProjection();
  }

  @Get('catalog')
  catalog(@Query() query: Record<string, unknown>) {
    return this.marketplace.browse({
      q: qstr(query.q),
      type: qstr(query.type),
      city: qstr(query.city),
      tag: qstr(query.tag),
      hint: qstr(query.hint),
      cursor: qstr(query.cursor),
      limit: qstr(query.limit),
      partnerId: qstr(query.partnerId),
      category: qstr(query.category),
      subcategory: qstr(query.subcategory),
      lane: qstr(query.lane),
      venue: qstr(query.venue),
      visual: qstr(query.visual),
      kind: qstr(query.kind),
      color: qstr(query.color),
      size: qstr(query.size),
      volume: qstr(query.volume),
      option: qstr(query.option),
      inStock: qstr(query.inStock),
      priceMin: qstr(query.priceMin),
      priceMax: qstr(query.priceMax),
      durationMin: qstr(query.durationMin),
      durationMax: qstr(query.durationMax),
      placeMode: qstr(query.placeMode),
      branch: qstr(query.branch),
      branchId: qstr(query.branchId),
      availableOn: qstr(query.availableOn),
      sort: qstr(query.sort),
      facets: qstr(query.facets),
      nearLat: qstr(query.nearLat),
      nearLng: qstr(query.nearLng),
      'variant.color': qstr(query['variant.color']),
      'variant.size': qstr(query['variant.size']),
      'variant.volume': qstr(query['variant.volume']),
    });
  }

  /** Documented Saudi cities catalog (stable ids) for searchable city UI. */
  @Get('cities')
  cities(@Query('q') q?: string) {
    return { items: listSaudiCities(q) };
  }

  @Get('catalog/:kind/:id')
  publishedItem(@Param('kind') kind: string, @Param('id') id: string) {
    return this.marketplace.getPublishedItem(kind, id);
  }

  @Get('favorites')
  @UseGuards(FirebaseAuthGuard)
  favorites(@CurrentUser() user: RequestUser) {
    return this.marketplace.listFavorites(user.firebaseUid);
  }

  @Post('favorites')
  @UseGuards(FirebaseAuthGuard)
  setFavorite(
    @CurrentUser() user: RequestUser,
    @Body() body: { kind?: string; id?: string; saved?: boolean },
  ) {
    return this.marketplace.setFavorite(user.firebaseUid, body.kind ?? '', body.id ?? '', body.saved);
  }

  @Get('partners')
  listPartners(
    @Query('type') type?: string,
    @Query('city') city?: string,
  ) {
    return this.marketplace.listPartners(type, city);
  }

  @Get('partners/:id')
  getPartner(@Param('id') id: string) {
    return this.marketplace.getPartner(id);
  }
}
