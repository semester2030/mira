import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Req } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CatalogAdMediaService } from './catalog-ad-media.service';
import { CatalogAdService } from './catalog-ad.service';
import { QualifiedViewRequest } from './catalog-view.policy';

function record(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

@Controller('partners-portal')
export class CatalogAdPartnerController {
  constructor(
    @Inject(CatalogAdService) private readonly ads: CatalogAdService,
    @Inject(CatalogAdMediaService) private readonly adMedia: CatalogAdMediaService,
  ) {}

  @Get('ads')
  @UseGuards(PartnerTokenGuard)
  list(@Req() request: PartnerRequest) {
    return this.ads.listForAdvertiser(request.partnerUser.partnerId);
  }

  @Get('ad-offer-targets')
  @UseGuards(PartnerTokenGuard)
  offerTargets(
    @Req() request: PartnerRequest,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
  ) {
    return this.ads.listOfferTargets(request.partnerUser.partnerId, { kind, q });
  }

  @Post('ads')
  @UseGuards(PartnerTokenGuard)
  create(@Req() request: PartnerRequest, @Body() body: unknown) {
    return this.ads.create(request.partnerUser.partnerId, record(body));
  }

  @Get('ads/:id')
  @UseGuards(PartnerTokenGuard)
  preview(@Req() request: PartnerRequest, @Param('id') id: string) {
    return this.ads.previewForAdvertiser(request.partnerUser.partnerId, id);
  }

  @Patch('ads/:id')
  @UseGuards(PartnerTokenGuard)
  update(@Req() request: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.ads.updateLink(request.partnerUser.partnerId, id, record(body));
  }

  @Post('ads/:id/submit-review')
  @UseGuards(PartnerTokenGuard)
  submit(@Req() request: PartnerRequest, @Param('id') id: string) {
    return this.ads.submit(request.partnerUser.partnerId, id);
  }

  @Post('ads/:id/withdraw')
  @UseGuards(PartnerTokenGuard)
  withdraw(@Req() request: PartnerRequest, @Param('id') id: string) {
    return this.ads.withdraw(request.partnerUser.partnerId, id);
  }

  @Get('ads/:id/stats')
  @UseGuards(PartnerTokenGuard)
  stats(@Req() request: PartnerRequest, @Param('id') id: string) {
    return this.ads.stats(request.partnerUser.partnerId, id);
  }

  @Get('ads/:id/media')
  @UseGuards(PartnerTokenGuard)
  listMedia(@Req() request: PartnerRequest, @Param('id') id: string) {
    return this.adMedia.listMedia(request.partnerUser.partnerId, id);
  }

  @Post('ads/:id/media')
  @UseGuards(PartnerTokenGuard)
  addMedia(@Req() request: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    const data = record(body);
    return this.adMedia.addMedia(request.partnerUser.partnerId, id, {
      mimeType: typeof data.mimeType === 'string' ? data.mimeType : '',
      dataBase64: typeof data.dataBase64 === 'string' ? data.dataBase64 : '',
      placement: typeof data.placement === 'string' ? data.placement : undefined,
      sourceMediaKey: typeof data.sourceMediaKey === 'string' ? data.sourceMediaKey : undefined,
    });
  }

  @Patch('ads/:id/media/order')
  @UseGuards(PartnerTokenGuard)
  reorderMedia(@Req() request: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    const data = record(body);
    const ids = Array.isArray(data.ids) ? data.ids.filter((v): v is string => typeof v === 'string') : [];
    return this.adMedia.reorder(request.partnerUser.partnerId, id, ids);
  }

  @Patch('ads/:id/media/:mediaId/primary')
  @UseGuards(PartnerTokenGuard)
  setPrimary(@Req() request: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.adMedia.setPrimary(request.partnerUser.partnerId, id, mediaId);
  }

  @Delete('ads/:id/media/:mediaId')
  @UseGuards(PartnerTokenGuard)
  removeMedia(@Req() request: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.adMedia.removeMedia(request.partnerUser.partnerId, id, mediaId);
  }
}

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class CatalogAdAdminController {
  constructor(@Inject(CatalogAdService) private readonly ads: CatalogAdService) {}

  @Get('catalog-ads')
  list() {
    return this.ads.listReviews();
  }

  @Get('catalog-ads/:id')
  preview(@Param('id') id: string) {
    return this.ads.adminPreview(id);
  }

  @Post('catalog-ads/:id/decision')
  decide(@Param('id') id: string, @Body() body: unknown) {
    return this.ads.decide({ ...record(body), id });
  }
}

@Controller('marketplace')
export class CatalogAdPublicController {
  constructor(@Inject(CatalogAdService) private readonly ads: CatalogAdService) {}

  @Get('ads')
  list() {
    return this.ads.listPublic();
  }

  @Get('ads/:id')
  ad(@Param('id') id: string) {
    return this.ads.publicAd(id);
  }

  @Post('ads/:id/link-open')
  link(@Param('id') id: string, @Body() body: unknown) {
    const data = record(body);
    return this.ads.linkOpen(id, typeof data.eventId === 'string' ? data.eventId : undefined);
  }

  @Get('view-counts/:kind/:id')
  count(@Param('kind') kind: string, @Param('id') id: string) {
    return this.ads.viewCount(kind, id);
  }

  @Post('view-events')
  view(@Body() body: QualifiedViewRequest) {
    return this.ads.recordView(body ?? {});
  }
}
