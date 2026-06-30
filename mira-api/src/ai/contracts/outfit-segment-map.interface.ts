export type OutfitSegmentZone =
  | 'head'
  | 'upperBody'
  | 'waist'
  | 'lowerBody'
  | 'feet'
  | 'accessories';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OutfitSegmentRegionDto {
  zone: OutfitSegmentZone;
  normalizedRect: NormalizedRect;
  /** Pixel-refined contour in normalized image space (0–1). */
  normalizedPolygon: NormalizedPoint[];
  labelAr: string;
  labelEn: string;
  colors: string[];
  confidence: number;
}

export interface OutfitSegmentMapDto {
  regions: OutfitSegmentRegionDto[];
  upperBodyColors: string[];
  lowerBodyColors: string[];
  shoeColors: string[];
  accessoryColors: string[];
  imageWidth: number;
  imageHeight: number;
  source: string;
}
