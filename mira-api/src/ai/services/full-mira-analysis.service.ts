import { BadRequestException, Injectable } from '@nestjs/common';
import { parseOccasion } from '../contracts/mira-occasion';
import { buildStyleFusion } from '../../intelligence/pipeline/fusion-engine';
import {
  buildMiraStyleReport,
} from '../../intelligence/pipeline/ingest-outfit';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { OutfitAnalysisService } from '../../outfit-analysis/outfit-analysis.service';
import { RecommendationsService } from '../../recommendations/recommendations.service';
import { SkinAnalysisService } from '../../skin-analysis/skin-analysis.service';
import { FullMiraAnalysisResponseDto } from '../dto/full-mira-analysis-response.dto';

@Injectable()
export class FullMiraAnalysisService {
  constructor(
    private readonly skinAnalysisService: SkinAnalysisService,
    private readonly outfitAnalysisService: OutfitAnalysisService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async analyze(
    authUser: RequestUser,
    skinBuffer: Buffer,
    outfitBuffer: Buffer,
    occasionId: string,
  ): Promise<FullMiraAnalysisResponseDto> {
    if (!skinBuffer?.length || !outfitBuffer?.length) {
      throw new BadRequestException('skinImage and outfitImage are required');
    }

    const occasion = parseOccasion(occasionId);
    if (!occasion) {
      throw new BadRequestException(
        'Invalid occasion. Use: wedding, work, casual, university, evening, eid, interview',
      );
    }

    const skinDto = await this.skinAnalysisService.analyze(authUser, skinBuffer);
    const outfitDto = await this.outfitAnalysisService.analyze(
      authUser,
      outfitBuffer,
      occasion,
    );

    const skinInternal = skinDto.skin;
    if (!skinInternal) {
      throw new BadRequestException('Skin analysis internal payload missing');
    }

    const fusion = buildStyleFusion(skinInternal, outfitDto.outfit);
    const styleReport = buildMiraStyleReport(outfitDto.outfit, fusion.summaryAr);
    const recommendation = await this.recommendationsService.build(
      authUser,
      skinInternal,
      outfitDto.outfit,
      occasion,
    );

    return FullMiraAnalysisResponseDto.from({
      skin: skinDto,
      outfit: outfitDto,
      styleReport,
      fusion,
      recommendation,
    });
  }
}
