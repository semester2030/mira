import 'dart:math' as math;

import '../models/skin_analysis_result.dart';
import '../providers/skin_analysis_provider.dart';
import '../utils/image_seed.dart';

/// Deterministic mock — simulates AI from image bytes until Perfect Corp API is connected.
class MockSkinAnalysisProvider implements SkinAnalysisProvider {
  static const _skinProfiles = [
    (
      ar: 'دهنية',
      en: 'Oily',
      hydrationBase: 55,
      oilinessBase: 70,
      adviceAr:
          'استخدمي غسولًا لطيفًا صباحًا ومساءً، ومرطبًا خفيفًا غير كوميدوجينيك. تجنبي المنتجات الثقيلة.',
      adviceEn:
          'Use a gentle cleanser morning and evening, and a light non-comedogenic moisturizer. Avoid heavy products.',
    ),
    (
      ar: 'جافة',
      en: 'Dry',
      hydrationBase: 40,
      oilinessBase: 20,
      adviceAr: 'ركزي على الترطيب العميق بسيروم حمض الهيالورونيك وكريم غني ليلاً.',
      adviceEn: 'Focus on deep hydration with hyaluronic serum and a rich night cream.',
    ),
    (
      ar: 'مختلطة',
      en: 'Combination',
      hydrationBase: 52,
      oilinessBase: 45,
      adviceAr: 'اعتني بمنطقة T بلطف واستخدمي منتجات متوازنة ترطب دون زيادة الدهون.',
      adviceEn: 'Treat your T-zone gently and use balanced products that hydrate without excess oil.',
    ),
    (
      ar: 'عادية',
      en: 'Normal',
      hydrationBase: 65,
      oilinessBase: 32,
      adviceAr: 'حافظي على روتين بسيط: تنظيف، ترطيب، وواقي شمس يوميًا.',
      adviceEn: 'Keep a simple routine: cleanse, moisturize, and daily sunscreen.',
    ),
  ];

  static const _undertones = [
    (ar: 'دافئ', en: 'Warm'),
    (ar: 'بارد', en: 'Cool'),
    (ar: 'محايد', en: 'Neutral'),
  ];

  static const _skinTones = [
    (ar: 'فاتح', en: 'Light'),
    (ar: 'متوسط', en: 'Medium'),
    (ar: 'داكن', en: 'Deep'),
  ];

  @override
  Future<SkinAnalysisResult> analyze(List<int> imageBytes) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    final seed = seedFromImageBytes(imageBytes);
    final rng = math.Random(seed);
    final profile = _skinProfiles[seed % _skinProfiles.length];
    final undertone = _undertones[(seed ~/ 7) % _undertones.length];
    final skinTone = _skinTones[(seed ~/ 13) % _skinTones.length];

    final hydration = (profile.hydrationBase + rng.nextInt(18)).clamp(0, 100);
    final oiliness = (profile.oilinessBase + rng.nextInt(18)).clamp(0, 100);
    final pores = (2 + rng.nextInt(4)).clamp(0, 5);
    final wrinkles = (1 + rng.nextInt(4)).clamp(0, 5);
    final darkSpots = (rng.nextInt(4)).clamp(0, 5);
    final acne = (rng.nextInt(4)).clamp(0, 5);
    final redness = (rng.nextInt(3)).clamp(0, 5);

    final beautyScore = ((hydration + (100 - oiliness)) / 2).clamp(0, 100).toDouble();

    final extraAr = acne >= 3
        ? ' استخدمي منتجات مهدئة للاحمرار والبثور.'
        : '';
    final extraEn = acne >= 3
        ? ' Use soothing products for redness and blemishes.'
        : '';

    int uiFromSeverity(int severity) =>
        ((5 - severity.clamp(0, 5)) / 5 * 100).round();

    final concernScores = <String, int>{
      'redness': uiFromSeverity(redness),
      'age_spot': uiFromSeverity(darkSpots),
      'pore': uiFromSeverity(pores),
      'texture': ((hydration + uiFromSeverity(pores)) / 2).round(),
      'dark_circle': ((hydration + uiFromSeverity(wrinkles)) / 2).round(),
      'wrinkle': uiFromSeverity(wrinkles),
      'moisture': hydration,
      'oiliness': (100 - oiliness).clamp(0, 100),
      'acne': uiFromSeverity(acne),
      'radiance': ((hydration + (100 - oiliness)) / 2).round(),
      'firmness': uiFromSeverity(wrinkles),
      'eye_bag': ((hydration + uiFromSeverity(wrinkles)) / 2).round(),
    };

    final skinAge = 26 + (seed % 14);

    return SkinAnalysisResult(
      beautyScore: beautyScore,
      skinTypeAr: profile.ar,
      skinTypeEn: profile.en,
      hydration: hydration,
      oiliness: oiliness,
      pores: pores,
      wrinkles: wrinkles,
      darkSpots: darkSpots,
      acne: acne,
      redness: redness,
      undertoneAr: undertone.ar,
      undertoneEn: undertone.en,
      skinToneAr: skinTone.ar,
      skinToneEn: skinTone.en,
      recommendationsAr: ['${profile.adviceAr}$extraAr'],
      recommendationsEn: ['${profile.adviceEn}$extraEn'],
      skinAge: skinAge,
      concernScores: concernScores,
    );
  }

}
