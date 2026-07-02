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
}
