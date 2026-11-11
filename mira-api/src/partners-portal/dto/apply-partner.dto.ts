import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ActivityRequestDto } from './apply-activities.dto';

export class ApplyPartnerDto {
  /** Legacy single type — derived from activities.identity when activities provided. */
  @IsOptional()
  @IsIn(['brand', 'clinic', 'salon', 'event_planner'])
  type?: string;

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

  /** Portal login password (never a 64-char hex token). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** New multi-step activities request (identity + taxonomy lines). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ActivityRequestDto)
  activities?: ActivityRequestDto;
}
