import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { BuildRecommendationDto } from './dto/build-recommendation.dto';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(FirebaseAuthGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post()
  async build(
    @CurrentUser() user: RequestUser,
    @Body() dto: BuildRecommendationDto,
  ) {
    return this.recommendationsService.build(
      user,
      dto.skin,
      dto.outfit,
      dto.occasion,
    );
  }

  @Get('history')
  async history(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.recommendationsService.history(
      user,
      Number.isNaN(parsed) ? 20 : parsed,
    );
  }
}
