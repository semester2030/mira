import { SkinAnalysisProviderResult } from '../contracts/skin-analysis-provider-result.interface';

export const SKIN_ANALYSIS_PROVIDER = Symbol('SKIN_ANALYSIS_PROVIDER');

export interface SkinAnalysisProvider {
  analyze(imageBytes: Buffer): Promise<SkinAnalysisProviderResult>;
}
