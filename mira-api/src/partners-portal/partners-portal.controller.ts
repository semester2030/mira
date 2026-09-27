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
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import {
  PartnerRequest,
  PartnerTokenGuard,
} from './guards/partner-token.guard';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { UpdateProductDto, UpdateServiceDto, UpsertProductDto, UpsertServiceDto } from './dto/catalog.dto';
import { TrackPartnerEventDto } from './dto/track-event.dto';
import { CatalogContentService } from '../marketplace/catalog-content.service';
import { PartnersPortalService } from './partners-portal.service';

class PartnerLoginDto {
  @IsString()
  email!: string;

  @IsString()
  accessToken!: string;
}

class RejectApplicationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Public + partner + admin routes for partners.mira.app */
@Controller('partners-portal')
export class PartnersPortalController {
  constructor(
    @Inject(PartnersPortalService) private readonly portal: PartnersPortalService,
    @Inject(CatalogContentService) private readonly content: CatalogContentService,
  ) {}

  @Post('apply')
  apply(@Body() dto: ApplyPartnerDto) {
    return this.portal.apply(dto);
  }

  @Get('apply/status/:token')
  applicationStatus(@Param('token') token: string) {
    return this.portal.getApplicationStatus(token);
  }

  @Post('login')
  login(@Body() dto: PartnerLoginDto) {
    return this.portal.login(dto.email, dto.accessToken);
  }

  @Post('track')
  track(@Body() dto: TrackPartnerEventDto) {
    return this.portal.trackEvent(dto);
  }

  @Get('me')
  @UseGuards(PartnerTokenGuard)
  dashboard(@Req() req: PartnerRequest) {
    return this.portal.getDashboard(req.partnerUser.partnerId);
  }

  @Post('products')
  @UseGuards(PartnerTokenGuard)
  createProduct(@Req() req: PartnerRequest, @Body() dto: UpsertProductDto) {
    return this.portal.createProduct(req.partnerUser.partnerId, dto);
  }

  @Patch('products/:id')
  @UseGuards(PartnerTokenGuard)
  updateProduct(
    @Req() req: PartnerRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.portal.updateProduct(req.partnerUser.partnerId, id, dto);
  }

  @Delete('products/:id')
  @UseGuards(PartnerTokenGuard)
  deleteProduct(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.portal.deleteProduct(req.partnerUser.partnerId, id);
  }

  @Post('services')
  @UseGuards(PartnerTokenGuard)
  createService(@Req() req: PartnerRequest, @Body() dto: UpsertServiceDto) {
    return this.portal.createService(req.partnerUser.partnerId, dto);
  }

  @Patch('services/:id')
  @UseGuards(PartnerTokenGuard)
  updateService(
    @Req() req: PartnerRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.portal.updateService(req.partnerUser.partnerId, id, dto);
  }

  @Delete('services/:id')
  @UseGuards(PartnerTokenGuard)
  deleteService(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.portal.deleteService(req.partnerUser.partnerId, id);
  }

  @Get('admin/applications')
  @UseGuards(AdminApiKeyGuard)
  listApplications(@Query('status') status?: string) {
    return this.portal.listApplications(status ?? 'pending');
  }

  @Post('admin/applications/:id/approve')
  @UseGuards(AdminApiKeyGuard)
  approve(@Param('id') id: string) {
    return this.portal.approveApplication(id);
  }

  @Get('content-policy')
  @UseGuards(PartnerTokenGuard)
  policy() {
    return this.content.policy();
  }

  @Post('products/:id/media')
  @UseGuards(PartnerTokenGuard)
  addProductMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: { mimeType: string; dataBase64: string }) {
    return this.content.addMedia(req.partnerUser.partnerId, 'product', id, body);
  }

  @Post('services/:id/media')
  @UseGuards(PartnerTokenGuard)
  addServiceMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: { mimeType: string; dataBase64: string }) {
    return this.content.addMedia(req.partnerUser.partnerId, 'service', id, body);
  }

  @Patch('products/:id/media/order')
  @UseGuards(PartnerTokenGuard)
  orderProductMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: { ids: string[] }) {
    return this.content.reorder(req.partnerUser.partnerId, 'product', id, body.ids);
  }

  @Patch('services/:id/media/order')
  @UseGuards(PartnerTokenGuard)
  orderServiceMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: { ids: string[] }) {
    return this.content.reorder(req.partnerUser.partnerId, 'service', id, body.ids);
  }

  @Patch('products/:id/media/:mediaId/primary')
  @UseGuards(PartnerTokenGuard)
  primaryProduct(@Req() req: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.content.setPrimary(req.partnerUser.partnerId, 'product', id, mediaId);
  }

  @Patch('services/:id/media/:mediaId/primary')
  @UseGuards(PartnerTokenGuard)
  primaryService(@Req() req: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.content.setPrimary(req.partnerUser.partnerId, 'service', id, mediaId);
  }

  @Delete('products/:id/media/:mediaId')
  @UseGuards(PartnerTokenGuard)
  removeProductMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.content.removeMedia(req.partnerUser.partnerId, 'product', id, mediaId);
  }

  @Delete('services/:id/media/:mediaId')
  @UseGuards(PartnerTokenGuard)
  removeServiceMedia(@Req() req: PartnerRequest, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.content.removeMedia(req.partnerUser.partnerId, 'service', id, mediaId);
  }

  @Post('products/:id/submit-review')
  @UseGuards(PartnerTokenGuard)
  submitProduct(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.content.submit(req.partnerUser.partnerId, 'product', id);
  }

  @Post('services/:id/submit-review')
  @UseGuards(PartnerTokenGuard)
  submitService(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.content.submit(req.partnerUser.partnerId, 'service', id);
  }

  @Get('products/:id/preview')
  @UseGuards(PartnerTokenGuard)
  previewProduct(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.content.preview(req.partnerUser.partnerId, 'product', id);
  }

  @Get('services/:id/preview')
  @UseGuards(PartnerTokenGuard)
  previewService(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.content.preview(req.partnerUser.partnerId, 'service', id);
  }

  @Get('media/:id')
  @UseGuards(PartnerTokenGuard)
  async partnerMedia(@Req() req: PartnerRequest, @Param('id') id: string) {
    const file = await this.content.readPartnerMedia(req.partnerUser.partnerId, id);
    return new StreamableFile(file.bytes, { type: file.mimeType });
  }

  @Post('import/simulated')
  @UseGuards(PartnerTokenGuard)
  importSimulated(@Req() req: PartnerRequest, @Body() body: { items: Parameters<CatalogContentService['importSimulated']>[1] }) {
    return this.content.importSimulated(req.partnerUser.partnerId, body.items ?? []);
  }

  @Patch('import/simulated/:externalId/mira-note')
  @UseGuards(PartnerTokenGuard)
  miraNote(@Req() req: PartnerRequest, @Param('externalId') externalId: string, @Body() body: { note: string }) {
    return this.content.setMiraNote(req.partnerUser.partnerId, externalId, body.note);
  }

  @Post('admin/applications/:id/reject')
  @UseGuards(AdminApiKeyGuard)
  reject(@Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.portal.rejectApplication(id, dto.reason);
  }
}
