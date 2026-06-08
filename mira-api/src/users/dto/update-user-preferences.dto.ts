import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(1920)
  @Max(new Date().getFullYear())
  birthYear?: number | null;

  @IsOptional()
  @IsString()
  locale?: string;
}
