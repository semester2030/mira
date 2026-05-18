import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { MiraOccasion } from '../../ai/contracts/mira-occasion';
import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';

export class BuildRecommendationDto {
  @IsObject()
  skin!: SkinAnalysisResult;

  @IsOptional()
  @IsObject()
  outfit?: OutfitAnalysisResult;

  @IsOptional()
  @IsEnum(MiraOccasion)
  occasion?: MiraOccasion;
}

/** Used when clients send nested JSON via multipart — optional future use. */
export class BuildRecommendationBodyDto {
  @ValidateNested()
  @Type(() => Object)
  skin!: SkinAnalysisResult;

  @IsOptional()
  @IsObject()
  outfit?: OutfitAnalysisResult;

  @IsOptional()
  @IsEnum(MiraOccasion)
  occasion?: MiraOccasion;
}
