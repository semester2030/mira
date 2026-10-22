import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateConsultationContextDto {
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

  /** Discussion focus for the current studio tab/piece/color — does not rewrite the saved report. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statedGoalAr?: string;
}
