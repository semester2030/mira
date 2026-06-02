import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import { MarketplaceService } from './marketplace.service';

/** Public catalog + skin-based matching (no auth — no PII in request). */
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post('match')
  match(@Body() dto: MatchMarketplaceDto) {
    return this.marketplace.match(dto);
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
