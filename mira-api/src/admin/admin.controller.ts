import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { AdminService } from './admin.service';
import {
  ApplicationsQueryDto,
  AuditLogsQueryDto,
  LeadsQueryDto,
  PaginationQueryDto,
  PartnersQueryDto,
  RejectApplicationDto,
  UpdatePartnerStatusDto,
  UsersQueryDto,
} from './dto/admin-query.dto';

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats/overview')
  overview() {
    return this.admin.getOverviewStats();
  }

  @Get('stats/analyses-trend')
  analysesTrend(@Query('days') days?: string) {
    const parsed = days ? Number.parseInt(days, 10) : 14;
    return this.admin.getAnalysisTrend(Number.isFinite(parsed) ? parsed : 14);
  }

  @Get('stats/audit-actions')
  auditActions() {
    return this.admin.getAuditActionSummary();
  }

  @Get('users')
  users(@Query() query: UsersQueryDto) {
    return this.admin.listUsers(query.page, query.limit, query.search);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: AuditLogsQueryDto) {
    return this.admin.listAuditLogs(
      query.page,
      query.limit,
      query.action,
      query.userId,
    );
  }

  @Get('feedback')
  feedback(@Query() query: PaginationQueryDto) {
    return this.admin.listFeedback(query.page, query.limit);
  }

  @Get('partners')
  partners(@Query() query: PartnersQueryDto) {
    return this.admin.listPartners(query.page, query.limit, query.status);
  }

  @Patch('partners/:id/status')
  partnerStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerStatusDto,
  ) {
    return this.admin.updatePartnerStatus(id, dto.status);
  }

  @Get('partners/applications')
  applications(@Query() query: ApplicationsQueryDto) {
    return this.admin.listApplications(query.status);
  }

  @Post('partners/applications/:id/approve')
  approveApplication(@Param('id') id: string) {
    return this.admin.approveApplication(id);
  }

  @Post('partners/applications/:id/reject')
  rejectApplication(
    @Param('id') id: string,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.admin.rejectApplication(id, dto.reason);
  }

  @Get('leads')
  leads(@Query() query: LeadsQueryDto) {
    return this.admin.listWebsiteLeads(query.page, query.limit, query.type);
  }

  @Get('system/config')
  systemConfig() {
    return this.admin.getSystemConfig();
  }

  /** Store-readiness audit ledger — admin key required (same guard as rest of /admin). */
  @Get('store-readiness')
  storeReadiness() {
    return this.readStoreReadinessFile('RESULTS_LEDGER.json');
  }

  @Get('store-readiness/clip-perf')
  storeReadinessClipPerf() {
    return this.readStoreReadinessFile('CLIP_PERF_AND_INTERACTION.json');
  }

  @Get('store-readiness/evidence/:name')
  storeReadinessEvidence(@Param('name') name: string) {
    const safe = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safe || safe !== name) {
      throw new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', messageAr: 'الدليل غير موجود' });
    }
    return this.readStoreReadinessFile(join('evidence', safe));
  }

  /** Soft-deactivate published media with non-playable (bare UUID) storage keys. */
  @Post('catalog-media/deactivate-orphan-blobs')
  deactivateOrphanBlobs(@Body() body: { mediaIds?: string[] }) {
    return this.admin.deactivateOrphanBareUuidMedia(
      Array.isArray(body?.mediaIds) ? body.mediaIds.filter((id) => typeof id === 'string') : undefined,
    );
  }

  private readStoreReadinessFile(rel: string) {
    const candidates = [
      join(__dirname, 'store-readiness', rel),
      join(process.cwd(), 'src', 'admin', 'store-readiness', rel),
      join(process.cwd(), 'dist', 'admin', 'store-readiness', rel),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        break;
      }
    }
    throw new NotFoundException({
      code: 'STORE_READINESS_LEDGER_MISSING',
      messageAr: 'سجل «هل ميرا جاهز لنشر» غير متوفر على الخادم بعد.',
    });
  }
}
