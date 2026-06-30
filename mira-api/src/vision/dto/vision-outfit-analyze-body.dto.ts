import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VisionOutfitAnalyzeBodyDto {
  @IsString()
  @IsNotEmpty()
  occasionId!: string;

  @IsIn(['quick', 'smart'])
  mode!: 'quick' | 'smart';

  /** JSON stringified skin snapshot — required when mode=smart. */
  @IsOptional()
  @IsString()
  skinSnapshot?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
