import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OutfitIntelligenceSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  occasionId?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  compatibilityScore!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  colorHarmonyScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  occasionMatchScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  styleBalanceScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  skinCompatibilityScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  analysisGate?: string;

  @IsString()
  @MaxLength(120)
  clothingTypeAr!: string;

  @IsString()
  @MaxLength(120)
  styleTypeAr!: string;

  @IsArray()
  @IsString({ each: true })
  dominantColorsAr!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedColorsAr?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rejectedColorsAr?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  styleVerdictAr?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matchReasonsAr?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mismatchReasonsAr?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedAccessoriesAr?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  suggestedMakeupAr?: string;

  @IsOptional()
  @IsIn(['vision_platform', 'deterministic', 'hybrid'])
  analysisSource?: string;
}

export class SaveOutfitSnapshotDto {
  @IsString()
  @MaxLength(64)
  occasionId!: string;

  @ValidateNested()
  @Type(() => OutfitIntelligenceSnapshotDto)
  intelligence!: OutfitIntelligenceSnapshotDto;
}
