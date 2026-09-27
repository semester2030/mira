import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpsertProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string;

  @IsInt()
  @Min(0)
  priceHalalas!: number;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsUrl({ require_protocol: true })
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skinTypes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stepAr?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr?: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceHalalas?: number;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsUrl({ require_protocol: true })
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skinTypes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stepAr?: string | null;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceHalalas?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;
}

export class UpsertServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMin?: number;

  @IsInt()
  @Min(0)
  priceHalalas!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
