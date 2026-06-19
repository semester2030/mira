import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { MiraStyleReport } from '../../intelligence/contracts/mira-style-report.interface';

export class OutfitAnalysisResponseDto {
  id!: string;
  createdAt!: string;
  outfit!: OutfitAnalysisResult;
  miraStyleReport!: MiraStyleReport;

  static from(
    id: string,
    createdAt: Date,
    outfit: OutfitAnalysisResult,
    miraStyleReport: MiraStyleReport,
  ): OutfitAnalysisResponseDto {
    return {
      id,
      createdAt: createdAt.toISOString(),
      outfit,
      miraStyleReport,
    };
  }
}
