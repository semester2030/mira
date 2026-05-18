import { MiraOccasion } from '../contracts/mira-occasion';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';

export const OUTFIT_ANALYSIS_PROVIDER = Symbol('OUTFIT_ANALYSIS_PROVIDER');

export interface OutfitAnalysisProvider {
  analyze(imageBytes: Buffer, occasion: MiraOccasion): Promise<OutfitAnalysisResult>;
}
