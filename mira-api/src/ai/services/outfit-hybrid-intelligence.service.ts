import { Injectable, Logger } from '@nestjs/common';
import { parseOccasion } from '../contracts/mira-occasion';
import {
  OutfitIntelligenceAnalysisDto,
  OutfitIntelligenceResponseDto,
  OutfitVisualProfileDto,
  SkinReportSnapshot,
} from '../contracts/outfit-intelligence.interface';
import { GoogleVisionOutfitService } from '../google-vision/google-vision-outfit.service';
import { LlmOutfitReasoningService } from '../llm/llm-outfit-reasoning.service';
import { seedFromImageBytes } from '../utils/image-seed';

@Injectable()
export class OutfitHybridIntelligenceService {
  private readonly logger = new Logger(OutfitHybridIntelligenceService.name);

  constructor(
    private readonly vision: GoogleVisionOutfitService,
    private readonly llm: LlmOutfitReasoningService,
  ) {}

  async analyze(
    imageBuffer: Buffer,
    occasionId: string,
    skin: SkinReportSnapshot,
  ): Promise<OutfitIntelligenceResponseDto> {
    let visual: OutfitVisualProfileDto;
    try {
      visual = await this.vision.analyze(imageBuffer);
    } catch (error) {
      this.logger.warn(`Vision fallback: ${String(error)}`);
      visual = this.deterministicVisual(imageBuffer);
    }

    try {
      const analysis = await this.llm.reason(skin, visual, occasionId);
      return { visual, analysis };
    } catch (error) {
      this.logger.warn(`LLM fallback: ${String(error)}`);
      const analysis = this.deterministicAnalysis(skin, visual, occasionId);
      return { visual, analysis };
    }
  }

  private deterministicVisual(imageBuffer: Buffer): OutfitVisualProfileDto {
    const seed = seedFromImageBytes(imageBuffer);
    const garments = ['فستان', 'عباءة', 'بدلة', 'تنورة وبلوزة'];
    const styles = ['أنيق', 'كلاسيكي', 'عصري', 'بسيط'];
    return {
      labels: ['Clothing', 'Fashion'],
      dominantColors: ['بيج', 'أسود'],
      clothingTypes: [garments[seed % garments.length]],
      accessoryTypes: [],
      styleSignals: [styles[(seed >> 3) % styles.length]],
      textureHints: [],
      confidence: 62,
      source: 'deterministic',
      garmentTypeAr: garments[seed % garments.length],
      garmentTypeEn: 'Outfit',
      styleTypeAr: styles[(seed >> 3) % styles.length],
      styleTypeEn: 'Style',
      contrastLevel: 0.5,
      formalityLevel: 0.55,
    };
  }

  private deterministicAnalysis(
    skin: SkinReportSnapshot,
    visual: OutfitVisualProfileDto,
    occasionId: string,
  ): OutfitIntelligenceAnalysisDto {
    const occasion = parseOccasion(occasionId);
    let score = 72;
    if ((skin.oiliness ?? 40) > 75) score -= 8;
    if ((skin.redness ?? 0) > 3) score -= 6;
    if (visual.dominantColors.includes('بيج') || visual.dominantColors.includes('كريمي')) {
      score += 6;
    }

    return {
      clothingType: visual.garmentTypeAr,
      styleType: visual.styleTypeAr,
      dominantColors: visual.dominantColors,
      compatibilityScore: Math.max(0, Math.min(100, score)),
      recommendedColors: ['بيج', 'كحلي', 'ذهبي'],
      rejectedColors: ['وردي نيون'],
      suggestedAccessories: visual.accessoryTypes,
      suggestedMakeup: 'نود محايد · blush خفيف',
      explanation: `تقييم ${score}/100 لإطلالة ${visual.garmentTypeAr} مع بشرة ${skin.skinType ?? ''} لمناسبة ${occasion ?? occasionId}.`,
      confidence: 68,
      matchReasons: ['تحليل محلي — بدون Vision/LLM'],
      mismatchReasons: [],
      recommendations: ['صورة أوضح ترفع دقة التحليل'],
      styleVerdict: score >= 75 ? 'إطلالة جيدة' : 'تحتاج تحسين',
      detectedPieces: visual.clothingTypes,
      visionLabels: visual.labels,
      visualConfidence: visual.confidence,
      contrastLevel:
        visual.contrastLevel >= 0.72 ? 'تباين عالٍ' : 'تباين متوسط',
      formalityLevel:
        visual.formalityLevel >= 0.72 ? 'رسمي' : 'شبه رسمي',
      analysisSource: 'deterministic',
      visualSource: visual.source,
      skinCompatibilityScore: score,
      occasionMatchScore: score - 4,
      styleBalanceScore: score - 2,
      colorHarmonyScore: score - 6,
    };
  }
}
