import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import {
  PartnerRequest,
  PartnerTokenGuard,
} from './guards/partner-token.guard';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { UpsertProductDto, UpsertServiceDto } from './dto/catalog.dto';
import { TrackPartnerEventDto } from './dto/track-event.dto';
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
  constructor(private readonly portal: PartnersPortalService) {}

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
    @Body() dto: UpsertProductDto,
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
    @Body() dto: UpsertServiceDto,
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

  @Post('admin/applications/:id/reject')
  @UseGuards(AdminApiKeyGuard)
  reject(@Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.portal.rejectApplication(id, dto.reason);
  }
}
