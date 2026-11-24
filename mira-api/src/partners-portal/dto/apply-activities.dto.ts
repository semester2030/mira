import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ActivityLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  activity!: string;

  @IsIn(['category', 'one'])
  scope!: 'category' | 'one';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  itemName?: string;
}

export class ActivityRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(['shop', 'brand', 'salon', 'independent', 'clinic', 'events', 'creator'], { each: true })
  identity!: Array<'shop' | 'brand' | 'salon' | 'independent' | 'clinic' | 'events' | 'creator'>;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(4)
  @IsIn(['venue', 'client_home', 'provider_home', 'remote'], { each: true })
  locations?: Array<'venue' | 'client_home' | 'provider_home' | 'remote'>;

  @IsString()
  @MinLength(2)
  @MaxLength(800)
  description!: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => ActivityLineDto)
  lines!: ActivityLineDto[];

  @IsOptional()
  @IsBoolean()
  advertiseForOthers?: boolean;

  @IsOptional()
  @IsBoolean()
  sellProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  provideServices?: boolean;
}

export class DecideActivitiesDto {
  @IsString()
  @MinLength(1)
  requestId!: string;

  @IsArray()
  @IsString({ each: true })
  approvedLineIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(800)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationNote?: string;
}
