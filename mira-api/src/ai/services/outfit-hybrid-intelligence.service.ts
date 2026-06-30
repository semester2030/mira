import { Injectable, Logger } from '@nestjs/common';
import { parseOccasion } from '../contracts/mira-occasion';
import {
  OutfitIntelligenceAnalysisDto,
  OutfitIntelligenceResponseDto,
  OutfitVisualProfileDto,
  SkinReportSnapshot,
} from '../contracts/outfit-intelligence.interface';
import { LlmOutfitReasoningService } from '../llm/llm-outfit-reasoning.service';
import { seedFromImageBytes } from '../utils/image-seed';
import { FashionVisionDocument } from '../../vision/schema/fashion-vision-document.v1';
import { VisionOrchestratorService } from '../../vision/vision-orchestrator.service';

@Injectable()
export class OutfitHybridIntelligenceService {
  private readonly logger = new Logger(OutfitHybridIntelligenceService.name);

  constructor(
    private readonly visionOrchestrator: VisionOrchestratorService,
    private readonly llm: LlmOutfitReasoningService,
  ) {}

  async analyze(
    imageBuffer: Buffer,
    occasionId: string,
    skin: SkinReportSnapshot,
  ): Promise<OutfitIntelligenceResponseDto> {
    let visual: OutfitVisualProfileDto;
    try {
      const result = await this.visionOrchestrator.analyze({
        imageBuffer,
        occasionId,
        mode: 'smart',
        skinSnapshot: skin as unknown as Record<string, unknown>,
      });
      visual = mapFashionVisionToVisualProfile(result.fashionVision);
    } catch (error) {
      this.logger.warn(`Vision Platform fallback: ${String(error)}`);
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

function mapFashionVisionToVisualProfile(
  doc: FashionVisionDocument,
): OutfitVisualProfileDto {
  const garments = doc.semantics.garments;
  const accessories = doc.semantics.accessories;
  const primary = garments[0];
  const overall = doc.fusion.overallConfidence;

  return {
    labels: garments.map((g) => g.typeId),
    dominantColors: doc.semantics.dominantColorIds,
    clothingTypes: garments.map((g) => g.typeId),
    accessoryTypes: accessories.map((a) => a.typeId),
    styleSignals: doc.semantics.styleArchetypeId ? [doc.semantics.styleArchetypeId] : [],
    textureHints: [],
    confidence: Math.round(overall * 100),
    source: 'vision_platform',
    garmentTypeAr: primary?.typeId ?? 'إطلالة',
    garmentTypeEn: primary?.categoryId ?? 'Outfit',
    styleTypeAr: doc.semantics.styleArchetypeId ?? 'أنيق',
    styleTypeEn: doc.semantics.styleArchetypeId ?? 'Style',
    contrastLevel: 0.55,
    formalityLevel: 0.55,
  };
}
