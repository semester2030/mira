import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { coerceQueryParam } from './catalog-filters';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import { MarketplaceService } from './marketplace.service';
import { listSaudiCities } from '../geo/saudi-cities';
import { absoluteBeautyIconPath } from './taxonomy/beauty-icon-assets';
import { absoluteCatalogIconPath } from './taxonomy/catalog-icon-assets';
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

  /** Lane index — public sees publicBrowse lanes only; audience=partner includes preview lanes. */
  @Get('taxonomy/lanes')
  listTaxonomyLanes(@Query('audience') audience?: string) {
    const aud = audience === 'partner' ? 'partner' : 'public';
    return {
      schemaVersion: 1,
      audience: aud,
      lanes: this.taxonomy.listPublicLanes({ audience: aud }),
    };
  }

  /**
   * Public taxonomy projection for a lane (derived; no partner auth).
   * Preview lanes (jewelry/children/…) require audience=partner until publicBrowse flips.
   */
  @Get('taxonomy')
  getTaxonomy(@Query('lane') lane?: string, @Query('audience') audience?: string) {
    const laneId = (lane ?? 'elegance').trim();
    const aud = audience === 'partner' ? 'partner' : 'public';
    try {
      return this.taxonomy.publicProjection({ lane: laneId, audience: aud });
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'TAXONOMY_LANE_UNSUPPORTED') {
        throw new BadRequestException({
          message: 'مسار التصنيفات غير مدعوم',
          messageAr: 'مسار التصنيفات غير مدعوم',
          code: 'TAXONOMY_LANE_UNSUPPORTED',
        });
      }
      if (code === 'TAXONOMY_LANE_NOT_PUBLIC') {
        throw new BadRequestException({
          message: 'هذا القسم غير متاح للعامة بعد',
          messageAr: 'هذا القسم غير متاح للعامة بعد',
          code: 'TAXONOMY_LANE_NOT_PUBLIC',
        });
      }
      throw e;
    }
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
      'variant.ringSize': qstr(query['variant.ringSize']),
      metal: qstr(query.metal),
      purity: qstr(query.purity ?? query.purityKarat),
      giftEligible: qstr(query.giftEligible),
      ageMonths: qstr(query.ageMonths),
      occasionType: qstr(query.occasionType ?? query.occasionTypeIds),
      occasionServiceOffer: qstr(query.occasionServiceOffer),
      eventType: qstr(query.eventType),
      shoeUsage: qstr(query.shoeUsage),
    } as any);
  }

  /** Documented Saudi cities catalog (stable ids) for searchable city UI. */
  @Get('cities')
  cities(@Query('q') q?: string) {
    return { items: listSaudiCities(q) };
  }

  /**
   * Fingerprinted catalog orb WebP files (jewelry/occasions/gifts/materials).
   * Taxonomy projection returns absolute URLs into this route — not merchant media.
   */
  @Get('catalog-icons/images/:file')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  streamCatalogIcon(@Param('file') file: string, @Res() res: Response) {
    if (!/^[a-z0-9._-]+\.webp$/i.test(file || '')) {
      throw new BadRequestException({ code: 'CATALOG_ICON_BAD_NAME' });
    }
    const abs = absoluteCatalogIconPath(file);
    if (!abs) throw new NotFoundException({ code: 'CATALOG_ICON_NOT_FOUND' });
    res.setHeader('Content-Type', 'image/webp');
    createReadStream(abs).pipe(res);
  }

  /** Beauty lane orb images (PNG/JPEG) keyed by taxonomy imageKey files. */
  @Get('beauty-icons/:file')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  streamBeautyIcon(@Param('file') file: string, @Res() res: Response) {
    if (!/^[a-z0-9._-]+\.(png|jpe?g|webp)$/i.test(file || '')) {
      throw new BadRequestException({ code: 'BEAUTY_ICON_BAD_NAME' });
    }
    const hit = absoluteBeautyIconPath(file);
    if (!hit) throw new NotFoundException({ code: 'BEAUTY_ICON_NOT_FOUND' });
    res.setHeader('Content-Type', hit.contentType);
    createReadStream(hit.abs).pipe(res);
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
