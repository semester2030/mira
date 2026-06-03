import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { SubmitWebsiteLeadDto } from './dto/submit-website-lead.dto';
import { WebsiteService } from './website.service';

/** Public endpoints for mira.app marketing site — no auth. */
@Controller('website')
export class WebsiteController {
  constructor(private readonly website: WebsiteService) {}

  @Get('features')
  features() {
    return this.website.getFeatures();
  }

  @Get('stats')
  stats() {
    return this.website.getStats();
  }

  @Get('partners-preview')
  partnersPreview(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 8;
    return this.website.getPartnersPreview(
      type,
      Number.isNaN(parsed) ? 8 : parsed,
    );
  }

  @Post('leads')
  submitLead(@Body() dto: SubmitWebsiteLeadDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : undefined;
    return this.website.submitLead(dto, ipHash);
  }
}
