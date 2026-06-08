import { IsString } from 'class-validator';

export class FullMiraAnalysisBodyDto {
  @IsString()
  occasion!: string;
}
