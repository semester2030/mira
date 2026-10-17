import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class ConsultationFaceSelectionDto {
  @IsString()
  @MaxLength(40)
  contextType!: string;

  @IsOptional() @IsString() @MaxLength(120) analysisId?: string;
  @IsOptional() @IsString() @MaxLength(120) reportRef?: string;
  @IsOptional() @IsString() @MaxLength(120) selectedResultId?: string;
  @IsOptional() @IsString() @MaxLength(120) selectedInsightId?: string;
  @IsOptional() @IsString() @MaxLength(120) selectedDetailRef?: string;
  @IsOptional() @IsString() @MaxLength(40) selectedRegion?: string;
  @IsOptional() @IsString() @MaxLength(120) selectedGuidanceId?: string;
  @IsOptional() @IsString() @MaxLength(120) frozenRecommendationRef?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) evidenceRefs?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) limitationRefs?: string[];
  @IsOptional() @IsString() @MaxLength(80) resultVersion?: string;
  @IsOptional() @IsBoolean() evidenceStale?: boolean;
  @IsOptional() @IsString() @MaxLength(120) contextLabelAr?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) suggestedQuestionKeys?: string[];
  @IsOptional() @IsString() @MaxLength(40) personalizationLevel?: string;
  @IsOptional() @IsString() @MaxLength(240) confidenceQualifier?: string;
  @IsOptional() @IsString() @MaxLength(600) publicFactAr?: string;
  @IsOptional() @IsString() @MaxLength(400) reasonAr?: string;
}

export class CreateConsultationSessionDto {
  @IsOptional()
  @IsUUID()
  skinAnalysisId?: string;

  @IsOptional()
  @IsUUID()
  outfitAnalysisId?: string;

  @IsOptional()
  @IsUUID()
  recolorAttemptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  occasionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  statedGoalAr?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsultationFaceSelectionDto)
  face?: ConsultationFaceSelectionDto;
}
