/** Vision context from Flutter — Phase Q0. Reference: #atelier-qel */
export type GarmentRecolorVisionContext = {
  regionRole?: 'upper' | 'lower' | 'full' | 'outer';
  material?: string;
  materialConfidence?: number;
  fit?: string;
  foldDensity?: 'low' | 'medium' | 'high';
  textureHint?: string;
  silhouetteHint?: string;
  garmentBbox?: { x: number; y: number; w: number; h: number };
  glossLevel?: 'matte' | 'semi' | 'glossy';
  /** Normalized polygon [[x,y], ...] — Phase Q2 crop-first. */
  garmentPolygon?: number[][];
};

export type NormalizedRect = { x: number; y: number; w: number; h: number };
