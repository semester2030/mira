import { Injectable } from '@nestjs/common';
import {
  MIRA_OCCASION_LABELS,
  MiraOccasion,
  occasionIndex,
} from '../contracts/mira-occasion';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';
import { OutfitAnalysisProvider } from '../providers/outfit-analysis.provider';
import { delay, nextInt, seedFromImageBytes } from '../utils/image-seed';

@Injectable()
export class MockOutfitAnalysisProvider implements OutfitAnalysisProvider {
  private readonly garments = [
    { ar: 'فستان', en: 'Dress' },
    { ar: 'عباءة', en: 'Abaya' },
    { ar: 'بدلة', en: 'Suit' },
    { ar: 'تنورة وبلوزة', en: 'Skirt & Blouse' },
  ];

  private readonly styles = [
    { ar: 'أنيق', en: 'Elegant' },
    { ar: 'كلاسيكي', en: 'Classic' },
    { ar: 'عصري', en: 'Modern' },
    { ar: 'راقي', en: 'Refined' },
  ];

  private readonly colorPalettes = [
    ['زيتوني', 'ذهبي'],
    ['وردي', 'بيج'],
    ['أسود', 'فضي'],
    ['أزرق ملكي', 'كريمي'],
    ['نبيتي', 'ذهبي'],
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

    const compatibilityScore = 78 + nextInt(rng, 22);
    const labels = MIRA_OCCASION_LABELS[occasion];
    const suitability = this.occasionSuitability(occasion, compatibilityScore, labels);

    return {
      compatibilityScore,
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
    };
  }

  private occasionSuitability(
    occasion: MiraOccasion,
    score: number,
    labels: { ar: string; en: string },
  ): { ar: string; en: string } {
    const level =
      score >= 90
        ? { ar: 'ممتاز', en: 'Excellent' }
        : score >= 80
          ? { ar: 'مناسب جدًا', en: 'Very suitable' }
          : { ar: 'مناسب', en: 'Suitable' };

    return {
      ar: `${level.ar} لمناسبة ${labels.ar}`,
      en: `${level.en} for ${labels.en}`,
    };
  }

  private alternativeColorsAr(occasion: MiraOccasion): string[] {
    switch (occasion) {
      case MiraOccasion.Wedding:
      case MiraOccasion.Eid:
        return ['ذهبي', 'شامبين', 'عنابي'];
      case MiraOccasion.Work:
      case MiraOccasion.Interview:
        return ['كحلي', 'بيج', 'رمادي فاتح'];
      case MiraOccasion.Evening:
        return ['أسود', 'ياقوتي', 'فضي'];
      default:
        return ['تركواز', 'مرجاني', 'لافندر'];
    }
  }

  private alternativeColorsEn(occasion: MiraOccasion): string[] {
    switch (occasion) {
      case MiraOccasion.Wedding:
      case MiraOccasion.Eid:
        return ['Gold', 'Champagne', 'Burgundy'];
      case MiraOccasion.Work:
      case MiraOccasion.Interview:
        return ['Navy', 'Beige', 'Light Grey'];
      case MiraOccasion.Evening:
        return ['Black', 'Ruby', 'Silver'];
      default:
        return ['Turquoise', 'Coral', 'Lavender'];
    }
  }
}
