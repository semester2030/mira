import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';

export class OutfitAnalysisResponseDto {
  id!: string;
  createdAt!: string;
  outfit!: OutfitAnalysisResult;

  static from(
    id: string,
    createdAt: Date,
    outfit: OutfitAnalysisResult,
  ): OutfitAnalysisResponseDto {
    return {
      id,
      createdAt: createdAt.toISOString(),
      outfit,
    };
  }
}
