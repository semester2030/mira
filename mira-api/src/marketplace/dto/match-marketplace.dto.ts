import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class MatchMarketplaceDto {
  @IsOptional()
  @IsString()
  skinTypeAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hydration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  oiliness?: number;

  @IsOptional()
  @IsObject()
  concernScores?: Record<string, number>;

  @IsOptional()
  @IsString()
  city?: string;
}
