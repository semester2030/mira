import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
