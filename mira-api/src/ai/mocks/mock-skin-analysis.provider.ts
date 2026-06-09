import { Injectable } from '@nestjs/common';
import { SkinAnalysisProviderResult } from '../contracts/skin-analysis-provider-result.interface';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { delay, nextInt, seedFromImageBytes } from '../utils/image-seed';

@Injectable()
export class MockSkinAnalysisProvider implements SkinAnalysisProvider {
  private readonly profiles = [
    {
      ar: 'دهنية',
      en: 'Oily',
      hydrationBase: 55,
      oilinessBase: 70,
      adviceAr:
        'استخدمي غسولًا لطيفًا صباحًا ومساءً، ومرطبًا خفيفًا غير كوميدوجينيك. تجنبي المنتجات الثقيلة.',
      adviceEn:
        'Use a gentle cleanser morning and evening, and a light non-comedogenic moisturizer. Avoid heavy products.',
    },
    {
      ar: 'جافة',
      en: 'Dry',
      hydrationBase: 40,
      oilinessBase: 20,
      adviceAr: 'ركزي على الترطيب العميق بسيروم حمض الهيالورونيك وكريم غني ليلاً.',
      adviceEn:
        'Focus on deep hydration with hyaluronic serum and a rich night cream.',
    },
    {
      ar: 'مختلطة',
      en: 'Combination',
      hydrationBase: 52,
      oilinessBase: 45,
      adviceAr: 'اعتني بمنطقة T بلطف واستخدمي منتجات متوازنة ترطب دون زيادة الدهون.',
      adviceEn:
        'Treat your T-zone gently and use balanced products that hydrate without excess oil.',
    },
    {
      ar: 'عادية',
      en: 'Normal',
      hydrationBase: 65,
      oilinessBase: 32,
      adviceAr: 'حافظي على روتين بسيط: تنظيف، ترطيب، وواقي شمس يوميًا.',
      adviceEn: 'Keep a simple routine: cleanse, moisturize, and daily sunscreen.',
    },
  ];

  private readonly undertones = [
    { ar: 'دافئ', en: 'Warm' },
    { ar: 'بارد', en: 'Cool' },
    { ar: 'محايد', en: 'Neutral' },
  ];

  private readonly skinTones = [
    { ar: 'فاتح', en: 'Light' },
    { ar: 'متوسط', en: 'Medium' },
    { ar: 'داكن', en: 'Deep' },
  ];

  async analyze(imageBytes: Buffer): Promise<SkinAnalysisProviderResult> {
    await delay(900);

    const seed = seedFromImageBytes(imageBytes);
    const rng = { seed };
    const profile = this.profiles[seed % this.profiles.length];
    const undertone = this.undertones[Math.floor(seed / 7) % this.undertones.length];
    const skinTone = this.skinTones[Math.floor(seed / 13) % this.skinTones.length];

    const hydration = Math.min(100, profile.hydrationBase + nextInt(rng, 18));
    const oiliness = Math.min(100, profile.oilinessBase + nextInt(rng, 18));
    const pores = Math.min(5, 2 + nextInt(rng, 4));
    const wrinkles = Math.min(5, 1 + nextInt(rng, 4));
    const darkSpots = Math.min(5, nextInt(rng, 4));
    const acne = Math.min(5, nextInt(rng, 4));
    const redness = Math.min(5, nextInt(rng, 3));

    const beautyScore = Math.min(
      100,
      Math.max(0, (hydration + (100 - oiliness)) / 2),
    );

    const extraAr = acne >= 3 ? ' استخدمي منتجات مهدئة للاحمرار والبثور.' : '';
    const extraEn =
      acne >= 3 ? ' Use soothing products for redness and blemishes.' : '';

    const uiFromSeverity = (s: number) =>
      Math.round(((5 - Math.min(5, s)) / 5) * 100);

    const concernScores: Record<string, number> = {
      redness: uiFromSeverity(redness),
      age_spot: uiFromSeverity(darkSpots),
      pore: uiFromSeverity(pores),
      texture: Math.round((hydration + uiFromSeverity(pores)) / 2),
      dark_circle: Math.round((hydration + uiFromSeverity(wrinkles)) / 2),
      wrinkle: uiFromSeverity(wrinkles),
      moisture: hydration,
      oiliness: 100 - oiliness,
      acne: uiFromSeverity(acne),
      radiance: Math.round((hydration + (100 - oiliness)) / 2),
      firmness: uiFromSeverity(wrinkles),
      eye_bag: Math.round((hydration + uiFromSeverity(wrinkles)) / 2),
    };

    const skinAge = 26 + (seed % 14);

    return {
      result: {
      beautyScore,
      skinTypeAr: profile.ar,
      skinTypeEn: profile.en,
      hydration,
      oiliness,
      pores,
      wrinkles,
      darkSpots,
      acne,
      redness,
      undertoneAr: undertone.ar,
      undertoneEn: undertone.en,
      skinToneAr: skinTone.ar,
      skinToneEn: skinTone.en,
      recommendationsAr: [`${profile.adviceAr}${extraAr}`],
      recommendationsEn: [`${profile.adviceEn}${extraEn}`],
      concernScores,
      skinAge,
    },
    };
  }
}
