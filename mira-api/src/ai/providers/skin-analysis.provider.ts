import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';

export const SKIN_ANALYSIS_PROVIDER = Symbol('SKIN_ANALYSIS_PROVIDER');

export interface SkinAnalysisProvider {
  analyze(imageBytes: Buffer): Promise<SkinAnalysisResult>;
}
