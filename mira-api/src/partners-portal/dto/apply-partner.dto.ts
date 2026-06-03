import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApplyPartnerDto {
  @IsIn(['brand', 'clinic', 'salon'])
  type!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  contactPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  storeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  crNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
