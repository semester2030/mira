import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class AuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class PartnersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'active', 'suspended'])
  status?: string;
}

export class ApplicationsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: string = 'pending';
}

export class UpdatePartnerStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

export class RejectApplicationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class LeadsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  type?: string;
}
