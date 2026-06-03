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
} from 'class-validator';

export class UpsertProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string;

  @IsInt()
  @Min(0)
  priceHalalas!: number;

  @IsUrl({ require_protocol: true })
  externalUrl!: string;

  @IsArray()
  @IsString({ each: true })
  concernTags!: string[];

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

export class UpsertServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string;

  @IsInt()
  @Min(5)
  durationMin!: number;

  @IsInt()
  @Min(0)
  priceHalalas!: number;

  @IsArray()
  @IsString({ each: true })
  concernTags!: string[];

  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
