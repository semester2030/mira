import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CatalogAdService } from './catalog-ad.service';
import { QualifiedViewRequest } from './catalog-view.policy';

function record(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

@Controller('partners-portal')
export class CatalogAdPartnerController {
  constructor(@Inject(CatalogAdService) private readonly ads: CatalogAdService) {}

  @Get('ads')
  @UseGuards(PartnerTokenGuard)
  list(@Req() request: PartnerRequest) {
    return this.ads.listForAdvertiser(request.partnerUser.partnerId);
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
  count() {
    return this.ads.viewCount();
  }

  @Post('view-events')
  view(@Body() body: QualifiedViewRequest) {
    return this.ads.recordView(body ?? {});
  }
}
