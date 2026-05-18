import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';

export class SkinAnalysisResponseDto {
  id!: string;
  createdAt!: string;
  skin!: SkinAnalysisResult;

  static from(id: string, createdAt: Date, skin: SkinAnalysisResult): SkinAnalysisResponseDto {
    return {
      id,
      createdAt: createdAt.toISOString(),
      skin,
    };
  }
}
