import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AnalyzeOutfitBodyDto {
  @IsString()
  @IsNotEmpty()
  occasion!: string;

  @IsOptional()
  @IsIn(['camera', 'gallery'])
  captureSource?: 'camera' | 'gallery';
}
