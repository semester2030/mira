import { Injectable } from '@nestjs/common';
import {
  MIRA_OCCASION_LABELS,
  MiraOccasion,
  occasionIndex,
} from '../contracts/mira-occasion';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';
import { OutfitStyleMetrics } from '../contracts/outfit-style-metrics.interface';
import { OutfitAnalysisProvider } from '../providers/outfit-analysis.provider';
import { delay, nextInt, seedFromImageBytes } from '../utils/image-seed';

/**
 * Phase 0 LEGACY — mock outfit provider for tests/dev only.
 * Blocked from serving production results via OutfitAnalysisService guard.
 * Canonical path: Vision Platform /ai/vision/outfit/analyze
 */
@Injectable()
export class MockOutfitAnalysisProvider implements OutfitAnalysisProvider {
  private readonly garments = [
    { ar: 'فستان', en: 'Dress' },
    { ar: 'عباءة', en: 'Abaya' },
    { ar: 'بدلة', en: 'Suit' },
    { ar: 'تنورة وبلوزة', en: 'Skirt & Blouse' },
    { ar: 'جumpsuit', en: 'Jumpsuit' },
  ];

  private readonly styles = [
    { ar: 'أنيق', en: 'Elegant' },
    { ar: 'كلاسيكي', en: 'Classic' },
    { ar: 'عصري', en: 'Modern' },
    { ar: 'راقي', en: 'Refined' },
    { ar: 'بسيط', en: 'Minimal' },
  ];

  private readonly colorPalettes = [
    ['زيتوني', 'ذهبي'],
    ['وردي', 'بيج'],
    ['أسود', 'فضي'],
    ['أزرق ملكي', 'كريمي'],
    ['نبيتي', 'ذهبي'],
    ['رمادي', 'أبيض'],
    ['مرجاني', 'بيج'],
  ];

  async analyze(
    imageBytes: Buffer,
    occasion: MiraOccasion,
  ): Promise<OutfitAnalysisResult> {
    await delay(850);

    const seed = seedFromImageBytes(imageBytes) ^ occasionIndex(occasion) * 997;
    const rng = { seed };

    const garment = this.garments[seed % this.garments.length];
    const style = this.styles[Math.floor(seed / 3) % this.styles.length];
    const palette = this.colorPalettes[Math.floor(seed / 5) % this.colorPalettes.length];
    const styleMetrics = this.generateMetrics(seed, occasion, rng);
    const provisionalScore = this.provisionalScore(styleMetrics);

    const labels = MIRA_OCCASION_LABELS[occasion];
    const suitability = this.occasionSuitability(occasion, provisionalScore, labels);

    return {
      compatibilityScore: provisionalScore,
      dominantColors: [...palette],
      garmentTypeAr: garment.ar,
      garmentTypeEn: garment.en,
      styleCategoryAr: style.ar,
      styleCategoryEn: style.en,
      occasionSuitabilityAr: suitability.ar,
      occasionSuitabilityEn: suitability.en,
      alternativeColorsAr: this.alternativeColorsAr(occasion),
      alternativeColorsEn: this.alternativeColorsEn(occasion),
      occasion,
      styleMetrics,
    };
  }

  private generateMetrics(
    seed: number,
    occasion: MiraOccasion,
    rng: { seed: number },
  ): OutfitStyleMetrics {
    const base = 44 + nextInt(rng, 38);
    const occasionBias = this.occasionBias(occasion, seed);

    const colorHarmony = clamp(base + nextInt(rng, 14) - 4, 0, 100);
    const occasionFit = clamp(base + occasionBias + nextInt(rng, 12) - 6, 0, 100);
    const styleCoherence = clamp(base + nextInt(rng, 10) - 3, 0, 100);
    const silhouetteBalance = clamp(base + nextInt(rng, 12) - 5, 0, 100);
    const polish = clamp(base + nextInt(rng, 10) - 6, 0, 100);

    return {
      colorHarmony,
      occasionFit,
      styleCoherence,
      silhouetteBalance,
      polish,
      colorClashSeverity: clamp(100 - colorHarmony + nextInt(rng, 16), 0, 100),
      occasionMismatchSeverity: clamp(100 - occasionFit + nextInt(rng, 14), 0, 100),
      tonalImbalanceSeverity: clamp(
        100 - Math.round((colorHarmony + styleCoherence) / 2) + nextInt(rng, 12),
        0,
        100,
      ),
      accessoryOverloadSeverity: clamp(18 + nextInt(rng, 40), 0, 100),
      formalityGapSeverity: clamp(100 - occasionFit + nextInt(rng, 10), 0, 100),
    };
  }

  private occasionBias(occasion: MiraOccasion, seed: number): number {
    switch (occasion) {
      case MiraOccasion.Wedding:
      case MiraOccasion.Interview:
        return seed % 2 === 0 ? 6 : -8;
      case MiraOccasion.Casual:
      case MiraOccasion.University:
        return 4;
      default:
        return 0;
    }
  }

  private provisionalScore(metrics: OutfitStyleMetrics): number {
    const positive =
      metrics.colorHarmony * 0.28 +
      metrics.occasionFit * 0.26 +
      metrics.styleCoherence * 0.18 +
      metrics.silhouetteBalance * 0.14 +
      metrics.polish * 0.14;
    return clamp(Math.round(positive * 0.6 + 22), 0, 100);
  }

  private occasionSuitability(
    occasion: MiraOccasion,
    score: number,
    labels: { ar: string; en: string },
  ): { ar: string; en: string } {
    const level =
      score >= 86
        ? { ar: 'ممتاز', en: 'Excellent' }
        : score >= 74
          ? { ar: 'مناسب جدًا', en: 'Very suitable' }
          : score >= 62
            ? { ar: 'مناسب', en: 'Suitable' }
            : score >= 48
              ? { ar: 'يحتاج تحسين', en: 'Needs improvement' }
              : { ar: 'غير مناسب حالياً', en: 'Not suitable yet' };

    return {
      ar: `${level.ar} لمناسبة ${labels.ar}`,
      en: `${level.en} for ${labels.en}`,
    };
  }

  private alternativeColorsAr(occasion: MiraOccasion): string[] {
    switch (occasion) {
      case MiraOccasion.Wedding:
      case MiraOccasion.Eid:
        return ['ذهبي', 'شامبين', 'عنابي', 'وردي-soft'];
      case MiraOccasion.Work:
      case MiraOccasion.Interview:
        return ['كحلي', 'بيج', 'رمادي فاتح', 'أبيض كريمي'];
      case MiraOccasion.Evening:
        return ['أسود', 'ياقوتي', 'فضي', 'زيتي داكن'];
      default:
        return ['تركواز', 'مرجاني', 'لافندر', 'بيج'];
    }
  }

  private alternativeColorsEn(occasion: MiraOccasion): string[] {
    switch (occasion) {
      case MiraOccasion.Wedding:
      case MiraOccasion.Eid:
        return ['Gold', 'Champagne', 'Burgundy', 'Soft Pink'];
      case MiraOccasion.Work:
      case MiraOccasion.Interview:
        return ['Navy', 'Beige', 'Light Grey', 'Cream White'];
      case MiraOccasion.Evening:
        return ['Black', 'Ruby', 'Silver', 'Dark Olive'];
      default:
        return ['Turquoise', 'Coral', 'Lavender', 'Beige'];
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
