import { SkinAnalysisResponseDto } from '../../skin-analysis/dto/skin-analysis-response.dto';
import { OutfitAnalysisResponseDto } from '../../outfit-analysis/dto/outfit-analysis-response.dto';
import { MiraRecommendation } from '../contracts/mira-recommendation.interface';
import {
  MiraStyleReport,
  StyleFusionPayload,
} from '../../intelligence/contracts/mira-style-report.interface';

export class FullMiraAnalysisResponseDto {
  skin!: SkinAnalysisResponseDto;
  outfit!: OutfitAnalysisResponseDto;
  styleReport!: MiraStyleReport;
  fusion!: StyleFusionPayload;
  recommendation!: MiraRecommendation;

  static from(payload: {
    skin: SkinAnalysisResponseDto;
    outfit: OutfitAnalysisResponseDto;
    styleReport: MiraStyleReport;
    fusion: StyleFusionPayload;
    recommendation: MiraRecommendation;
  }): FullMiraAnalysisResponseDto {
    return {
      skin: payload.skin,
      outfit: payload.outfit,
      styleReport: payload.styleReport,
      fusion: payload.fusion,
      recommendation: payload.recommendation,
    };
  }
}
