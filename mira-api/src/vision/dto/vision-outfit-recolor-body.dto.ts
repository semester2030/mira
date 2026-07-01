import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VisionOutfitRecolorBodyDto {
  /** Arabic fashion color name — e.g. أسود، ذهبي */
  @IsString()
  @IsNotEmpty()
  targetColorAr!: string;

  @IsOptional()
  @IsString()
  targetColorHex?: string;

  /** Arabic garment label — e.g. فستان، بلوزة */
  @IsOptional()
  @IsString()
  garmentLabelAr?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  /** Full Arabic prompt — optional override from app «مختبر البرومبت». */
  @IsOptional()
  @IsString()
  customPromptAr?: string;

  /** JSON — Phase Q0 context from Flutter (material, geometry, bbox). */
  @IsOptional()
  @IsString()
  visionContext?: string;
}
