import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/data/datasources/outfit_segmentation_api_data_source.dart';
import 'package:mirra/features/outfit_analysis/data/datasources/vision_api_data_source.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/canonical_garment.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_capture_validation.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_visual_profile.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/user_gender.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/skin_palette_mapper.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/undertone_resolver.dart';
import 'package:mirra/features/outfit_analysis/domain/services/deterministic_outfit_engine.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_capture_validator.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_image_analyzer.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_intelligence_service.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segmentation_service.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_trust_scoring.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});

  group('SkinPaletteMapper', () {
    test('warm undertone recommends warm palettes', () {
      final profile = SkinPaletteMapper.fromSkinReport(_warmSkin());
      expect(profile.undertone, SkinUndertone.warm);
      expect(profile.recommendedPalettes, contains('زيتوني'));
      expect(profile.blockedPalettes, contains('فضي'));
    });

    test('high oiliness blocks shiny fabrics', () {
      final profile = SkinPaletteMapper.fromSkinReport(_warmSkin(oiliness: 82));
      expect(profile.blockedPalettes, contains('أقمشة لامعة'));
      expect(profile.skinIssueFlags, contains('high_oiliness'));
    });
  });

  group('DeterministicOutfitEngine', () {
    test('trust layer never drops strong outfits below floor', () {
      final adjusted = OutfitTrustScoring.applyFinalScore(
        rawScore: 49,
        occasionScore: 85,
        styleScore: 78,
        colorHarmonyScore: 70,
      );
      expect(adjusted, greaterThanOrEqualTo(70));
    });

    test('removes duplicate alternative and rejected colors', () async {
      final visual = OutfitVisualProfile(
        dominantColors: const ['بيج'],
        garmentTypeAr: 'فستان',
        styleTypeAr: 'كلاسيكي',
        source: 'test',
      );
      final palette = SkinPaletteMapper.fromSkinReport(_warmSkin());

      final analysis = DeterministicOutfitEngine.analyze(
        skin: _warmSkin(),
        visual: visual,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
      );

      expect(
        analysis.recommendedColors.length,
        analysis.recommendedColors.toSet().length,
      );
      expect(
        analysis.rejectedColors.length,
        analysis.rejectedColors.toSet().length,
      );
      expect(palette.recommendedPalettes, isNotEmpty);
    });

    test('male gender removes makeup recommendations', () async {
      final visual = await OutfitImageAnalyzer.analyze(
        await _solidImageFile(180, 140, 90),
      );

      final male = DeterministicOutfitEngine.analyze(
        skin: _warmSkin(),
        visual: visual,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
        gender: UserGender.male,
      );
      final female = DeterministicOutfitEngine.analyze(
        skin: _warmSkin(),
        visual: visual,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
        gender: UserGender.female,
      );

      expect(male.suggestedMakeup, isEmpty);
      expect(female.suggestedMakeup, isNotEmpty);
      expect(male.suggestedAccessories, contains('ساعة'));
    });

    test('match reasons use natural Arabic phrasing', () async {
      final visual = OutfitVisualProfile(
        dominantColors: const ['بيج', 'كريمي'],
        garmentTypeAr: 'فستان',
        styleTypeAr: 'كلاسيكي',
        formalityLevel: 0.7,
        source: 'test',
      );

      final analysis = DeterministicOutfitEngine.analyze(
        skin: _warmSkin(),
        visual: visual,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
      );

      expect(analysis.whyItFits.any((r) => r.contains('تدرج البشرة')), isTrue);
      expect(analysis.whyItFits.any((r) => r.contains('undertone')), isFalse);
    });

    test('analyzeFromCanonicalGarments uses canonical source', () {
      final analysis = DeterministicOutfitEngine.analyzeFromCanonicalGarments(
        garments: _mockCanonicalGarments(),
        skin: _warmSkin(),
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
      );
      expect(analysis.visualSource, 'canonical_garment');
      expect(analysis.compatibilityScore, inInclusiveRange(0, 100));
    });
  });

  group('OutfitIntelligenceService', () {
    test('produces deterministic score for fixed skin and image', () async {
      final file = await _solidImageFile(180, 140, 90);
      final service = OutfitIntelligenceService(
        visionApi: _MockVisionApi(),
        segmentationApi: _NoNetworkSegmentation(),
        segmentationService: _TestSegmentation(),
        captureValidatorFactory: _AlwaysValidCaptureValidator.new,
      );

      final first = await service.analyze(
        skin: _warmSkin(),
        outfitImage: file,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
      );
      final second = await service.analyze(
        skin: _warmSkin(),
        outfitImage: file,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.smart,
      );

      expect(first.compatibilityScore, second.compatibilityScore);
      expect(first.dominantColors, second.dominantColors);
      expect(first.compatibilityScore, inInclusiveRange(0, 100));
      expect(first.skinCompatibilityScore, greaterThan(0));
      expect(first.analysisSource, 'deterministic');
      expect(first.visualSource, 'canonical_garment');
      expect(first.whyItFits, isNotEmpty);
    });

    test('interview occasion penalizes low formality profile colors', () async {
      final casualImage = await _solidImageFile(40, 180, 220);
      final visual = await OutfitImageAnalyzer.analyze(casualImage);

      final interview = DeterministicOutfitEngine.analyze(
        skin: _coolSkin(),
        visual: visual,
        occasion: MiraOccasion.interview,
        mode: OutfitAnalysisMode.smart,
      );
      final casual = DeterministicOutfitEngine.analyze(
        skin: _coolSkin(),
        visual: visual,
        occasion: MiraOccasion.casual,
        mode: OutfitAnalysisMode.smart,
      );

      expect(
        interview.occasionMatchScore,
        lessThanOrEqualTo(casual.occasionMatchScore + 5),
      );
    });

    test('quick mode works without SkinReport', () async {
      final file = await _solidImageFile(180, 140, 90);
      final service = OutfitIntelligenceService(
        visionApi: _MockVisionApi(),
        segmentationApi: _NoNetworkSegmentation(),
        segmentationService: _TestSegmentation(),
        captureValidatorFactory: _AlwaysValidCaptureValidator.new,
      );

      final result = await service.analyze(
        outfitImage: file,
        occasion: MiraOccasion.casual,
        mode: OutfitAnalysisMode.quick,
      );

      expect(result.isQuickMode, isTrue);
      expect(result.skinCompatibilityScore, 0);
      expect(result.suggestedMakeup, isEmpty);
      expect(result.compatibilityScore, inInclusiveRange(0, 100));
      expect(result.visualSource, 'canonical_garment');
      expect(
        result.compatibilityScore,
        DeterministicOutfitEngine.computeWeightedFinalQuick(
          occasionScore: result.occasionMatchScore,
          styleScore: result.styleBalanceScore,
          colorHarmonyScore: result.colorHarmonyScore,
        ),
      );
    });

    test('smart mode requires SkinReport', () async {
      final file = await _solidImageFile(180, 140, 90);
      final service = OutfitIntelligenceService(
        visionApi: _MockVisionApi(),
        segmentationApi: _NoNetworkSegmentation(),
        segmentationService: _TestSegmentation(),
        captureValidatorFactory: _AlwaysValidCaptureValidator.new,
      );

      expect(
        () => service.analyze(
          outfitImage: file,
          occasion: MiraOccasion.work,
          mode: OutfitAnalysisMode.smart,
        ),
        throwsArgumentError,
      );
    });

    test('quick mode avoids undertone references in match reasons', () async {
      final visual = OutfitVisualProfile(
        dominantColors: const ['كحلي', 'بيج'],
        garmentTypeAr: 'فستان',
        styleTypeAr: 'كلاسيكي',
        formalityLevel: 0.7,
        source: 'test',
      );

      final analysis = DeterministicOutfitEngine.analyze(
        visual: visual,
        occasion: MiraOccasion.work,
        mode: OutfitAnalysisMode.quick,
      );

      expect(analysis.isQuickMode, isTrue);
      expect(
        analysis.whyItFits.any((r) => r.toLowerCase().contains('undertone')),
        isFalse,
      );
    });
  });
}

List<CanonicalGarment> _mockCanonicalGarments() => [
  CanonicalGarment.fromJson({
    'garmentId': 'garm_test_blazer',
    'version': 'garment-schema-v1',
    'identity': {
      'categoryId': 'outerwear',
      'typeId': 'blazer',
      'entityClass': 'garment',
    },
    'attributes': {
      'colors': ['beige_linen', 'cream_soft'],
      'material': {'kind': 'estimated', 'value': 'linen'},
      'season': ['all_season'],
      'occasion': ['work'],
      'styleHints': ['business'],
    },
    'geometryRef': {'segmentId': 's1', 'regionRole': 'outerwear'},
    'confidence': 0.82,
    'fieldConfidence': const [],
    'availability': 'detected',
    'source': 'vision',
    'limitations': const [],
    'explainability': const [],
    'localeLabels': {'en': 'Blazer', 'ar': 'سترة رسمية'},
    'runtime': const {},
    'mappingVersion': 'garment-mapping-v1',
    'createdAt': '2026-08-30T00:00:00.000Z',
    'updatedAt': '2026-08-30T00:00:00.000Z',
  }),
];

class _MockVisionApi extends VisionApiDataSource {
  @override
  Future<VisionOutfitAnalyzeResult?> analyze({
    required String imagePath,
    required String occasionId,
    required String mode,
    Map<String, dynamic>? skinSnapshot,
    String locale = 'ar',
  }) async {
    return VisionOutfitAnalyzeResult(
      garments: _mockCanonicalGarments(),
      meta: const {
        'analysisGate': 'proceed',
        'confidence': 82,
        'phase': 'test-canonical-mock',
      },
    );
  }
}

class _NoNetworkSegmentation extends OutfitSegmentationApiDataSource {
  @override
  Future<OutfitSegmentMap?> segment({required String imagePath}) async => null;
}

class _AlwaysValidCaptureValidator extends OutfitCaptureValidator {
  @override
  Future<OutfitCaptureValidationResult> validateFile(File file) async =>
      OutfitCaptureValidationResult.ready;

  @override
  Future<void> dispose() async {}
}

class _TestSegmentation extends OutfitSegmentationService {
  @override
  Future<OutfitSegmentMap> buildFromFrozenImage(
    File imageFile, {
    OutfitVisualProfile? visual,
    List<VisionLocalizedObject> visionObjects = const [],
  }) async => const OutfitSegmentMap(
    regions: [
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.upperBody,
        normalizedRect: Rect.fromLTWH(0.2, 0.2, 0.6, 0.45),
        labelAr: 'قطعة علوية',
        labelEn: 'Top',
        colors: ['بيج'],
        confidence: 0.9,
      ),
    ],
    upperBodyColors: ['بيج'],
    source: 'test',
    isVisualTrusted: true,
  );
}

SkinReport _warmSkin({int oiliness = 45}) {
  return SkinReport(
    skinType: 'مختلطة',
    score: 72,
    hydration: 58,
    oiliness: oiliness,
    pores: 2,
    wrinkles: 1,
    spots: 1,
    acne: 1,
    redness: 1,
    undertone: 'دافئ',
    undertoneEn: 'Warm',
    skinTone: 'متوسط',
    skinToneEn: 'Medium',
    advice: 'روتين متوازن',
    concernScores: const {
      'redness': 72,
      'age_spot': 70,
      'dark_circle': 65,
      'oiliness': 100 - 45,
      'radiance': 62,
      'firmness': 68,
    },
  );
}

SkinReport _coolSkin() {
  return SkinReport(
    skinType: 'عادية',
    score: 76,
    hydration: 62,
    oiliness: 30,
    pores: 2,
    wrinkles: 1,
    spots: 1,
    acne: 0,
    redness: 2,
    undertone: 'بارد',
    undertoneEn: 'Cool',
    skinTone: 'فاتح',
    skinToneEn: 'Light',
    advice: 'ترطيب يومي',
    concernScores: const {
      'redness': 68,
      'age_spot': 75,
      'dark_circle': 70,
      'oiliness': 70,
      'radiance': 74,
    },
  );
}

Future<File> _solidImageFile(int r, int g, int b) async {
  final image = img.Image(width: 640, height: 960);
  img.fill(image, color: img.ColorRgb8(r, g, b));
  final bytes = Uint8List.fromList(img.encodeJpg(image));
  final file = File(
    '${Directory.systemTemp.path}/mira_outfit_test_${r}_${g}_$b.jpg',
  );
  await file.writeAsBytes(bytes);
  return file;
}
