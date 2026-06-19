import { IsNotEmpty, IsString } from 'class-validator';

export class OutfitIntelligenceBodyDto {
  @IsString()
  @IsNotEmpty()
  occasion!: string;

  /** JSON stringified SkinReport snapshot from Flutter. */
  @IsString()
  @IsNotEmpty()
  skinReport!: string;
}
