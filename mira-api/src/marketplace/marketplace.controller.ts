import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { MatchMarketplaceDto } from './dto/match-marketplace.dto';
import { MarketplaceService } from './marketplace.service';

/** Public catalog + skin-based matching (no auth — no PII in request). */
@Controller('marketplace')
export class MarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Post('match')
  match(@Body() dto: MatchMarketplaceDto) {
    return this.marketplace.match(dto);
  }

  @Get('catalog')
  catalog(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('tag') tag?: string,
    @Query('hint') hint?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('partnerId') partnerId?: string,
    @Query('category') category?: string,
    @Query('lane') lane?: string,
    @Query('venue') venue?: string,
    @Query('visual') visual?: string,
  ) {
    return this.marketplace.browse({ q, type, city, tag, hint, cursor, limit, partnerId, category, lane, venue, visual });
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
