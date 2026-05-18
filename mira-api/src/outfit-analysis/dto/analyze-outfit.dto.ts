import { IsNotEmpty, IsString } from 'class-validator';

export class AnalyzeOutfitBodyDto {
  @IsString()
  @IsNotEmpty()
  occasion!: string;
}
