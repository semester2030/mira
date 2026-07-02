import 'dart:developer' as developer;
import 'dart:io';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../data/datasources/outfit_segmentation_api_data_source.dart';
import '../../data/datasources/vision_api_data_source.dart';
import '../../data/services/outfit_analysis_cache_service.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../adapters/fashion_vision_to_engine_adapter.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_analysis_mode.dart';
import '../entities/fashion_vision_document.dart';
import '../entities/outfit_segment_map.dart';
import '../entities/user_gender.dart';
import '../entities/outfit_visual_profile.dart';
import '../helpers/outfit_result_trust.dart';
import '../../../../core/exceptions/vision_platform_exception.dart';
import 'outfit_capture_validator.dart';
import 'deterministic_outfit_engine.dart';
import 'outfit_segmentation_service.dart';

/// Capture → Vision Platform API → segment map → deterministic scoring.
/// Phase 7 — VisionApiDataSource only; no Google Vision · no silent fallback.
/// Reference: docs/mira-vision-platform.html
class OutfitIntelligenceService {
  OutfitIntelligenceService({
    VisionApiDataSource? visionApi,
    OutfitAnalysisCacheService? cacheService,
    OutfitSegmentationService? segmentationService,
    OutfitSegmentationApiDataSource? segmentationApi,
  })  : _visionApi = visionApi ?? VisionApiDataSource(),
        _cache = cacheService,
        _segmentation = segmentationService ?? OutfitSegmentationService(),
        _segmentationApi = segmentationApi ?? OutfitSegmentationApiDataSource();

  final VisionApiDataSource _visionApi;
  final OutfitAnalysisCacheService? _cache;
  final OutfitSegmentationService _segmentation;
  final OutfitSegmentationApiDataSource _segmentationApi;

  Future<OutfitAnalysis> analyze({
    SkinReport? skin,
    required File outfitImage,
    required MiraOccasion occasion,
    required OutfitAnalysisMode mode,
    UserGender? gender,
  }) async {
    if (mode == OutfitAnalysisMode.smart && skin == null) {
      throw ArgumentError('Smart mode requires a SkinReport');
    }

    final captureValidator = OutfitCaptureValidator();
    try {
      final preCapture = await captureValidator.validateFile(outfitImage);
      if (!preCapture.isValid) {
        throw VisionPlatformException(
          code: 'OUTFIT_PHOTO_UNTRUSTED',
          message: preCapture.hint?.name ?? 'capture_invalid',
          userMessageAr: preCapture.hintAr,
        );
      }
    } finally {
      await captureValidator.dispose();
    }

    final bytes = await outfitImage.readAsBytes();
    final cache = _cache ?? await OutfitAnalysisCacheService.create();
    final skinKey = mode == OutfitAnalysisMode.smart
        ? cache.skinKeyFromReport(
            skinType: skin!.skinType,
            undertone: skin.undertone.isNotEmpty ? skin.undertone : skin.undertoneEn,
            oiliness: skin.oiliness,
            redness: skin.redness,
          )
        : 'quick_no_skin';
    final cacheKey = await cache.buildKey(
      imageBytes: bytes,
      skinKey: skinKey,
      occasionId: occasion.id,
      modeId: mode.name,
    );

    final cached = await cache.get(cacheKey);
    if (cached != null) {
      final cachedAnalysis = cached.analysis.copyWith(frozenImagePath: outfitImage.path);
      final cachedTrust = OutfitResultTrustPolicy.evaluate(cachedAnalysis);
      if (!cachedTrust.isBlocked) {
        return cachedAnalysis;
      }
    }

    final visionResult = await _resolveVisionFromPlatform(
      outfitImage: outfitImage,
      occasion: occasion,
      mode: mode,
      skin: skin,
    );

    final fashion = visionResult.fashionVision;
    final visual = FashionVisionToEngineAdapter.toVisualProfile(fashion);
    final visionObjects =
        FashionVisionToEngineAdapter.toLocalizedObjects(fashion);

    final segmentMap = await _buildSegmentMap(
      outfitImage,
      visionObjects: visionObjects,
    );

    final mergedVisual = _mergeRegionColors(visual, segmentMap);
    final analysis = DeterministicOutfitEngine.analyze(
      skin: skin,
      visual: mergedVisual.copyWith(source: 'vision_platform'),
      occasion: occasion,
      mode: mode,
      gender: gender ?? AnalysisSession.userGender,
    );

    final garmentColors = _garmentColorsOnly(segmentMap);
    final mismatch = _piecesNeedingAttention(segmentMap, analysis.mismatchReasons);
    if (segmentMap.validationMessage != null) {
      mismatch.insert(0, segmentMap.validationMessage!);
    }

    if (!segmentMap.hasTrustedOverlay) {
      throw VisionPlatformException(
        code: 'OUTFIT_RESULT_UNTRUSTED',
        message: 'Segment map not visually trusted',
        userMessageAr: segmentMap.validationMessage ??
            OutfitResultTrustPolicy.blockedDefaultMessage,
      );
    }

    final enriched = analysis.copyWith(
      frozenImagePath: outfitImage.path,
      segmentMap: segmentMap,
      upperBodyColors: segmentMap.upperBodyColors,
      lowerBodyColors: segmentMap.lowerBodyColors,
      shoeColors: segmentMap.shoeColors,
      accessoryColors: segmentMap.accessoryColors,
      dominantColors: garmentColors.isNotEmpty ? garmentColors : mergedVisual.dominantColors,
      recommendedColors: analysis.recommendedColors,
      detectedPieces: segmentMap.hasTrustedOverlay
          ? _piecesFromSegments(segmentMap, analysis.detectedPieces)
          : analysis.detectedPieces,
      mismatchReasons: mismatch,
      recommendations: DeterministicOutfitEngine.buildImprovementActions(
        mismatch,
        occasion,
        isSmart: mode == OutfitAnalysisMode.smart,
        undertoneAr: skin != null
            ? (skin.undertone.isNotEmpty ? skin.undertone : skin.undertoneEn)
            : null,
      ),
      visualSource: 'vision_platform',
      analysisGate: visionResult.fashionVision.analysisGate,
      photoTrustMessageAr: visionResult.userMessageAr,
      visualConfidence: (visionResult.fashionVision.overallConfidence * 100).round().clamp(0, 100),
    );

    final trust = OutfitResultTrustPolicy.evaluate(enriched);
    if (trust.isBlocked) {
      throw VisionPlatformException(
        code: 'OUTFIT_RESULT_UNTRUSTED',
        message: 'Segment map or analysis gate blocked',
        userMessageAr: trust.messageAr,
      );
    }

    await cache.put(key: cacheKey, visual: mergedVisual, analysis: enriched);
    return enriched;
  }

  Future<OutfitSegmentMap> _buildSegmentMap(
    File outfitImage, {
    required List<VisionLocalizedObject> visionObjects,
  }) async {
    if (MiraApiConfig.useBackend) {
      try {
        final serverMap = await _segmentationApi.segment(imagePath: outfitImage.path);
        if (serverMap != null && serverMap.regions.isNotEmpty) {
          developer.log(
            'Server pixel contours: ${serverMap.regions.length} regions (${serverMap.source})',
            name: 'OutfitIntelligenceService',
          );
          final enriched = await _segmentation.enrichServerColors(outfitImage, serverMap);
          return enriched.copyWith(
            isVisualTrusted: true,
            validationMessage: null,
          );
        }
      } catch (error, stack) {
        developer.log(
          'Server segmentation failed — local fallback',
          error: error,
          stackTrace: stack,
          name: 'OutfitIntelligenceService',
        );
      }
    }

    return _segmentation.buildFromFrozenImage(
      outfitImage,
      visionObjects: visionObjects,
    );
  }

  Future<VisionOutfitAnalyzeResult> _resolveVisionFromPlatform({
    required File outfitImage,
    required MiraOccasion occasion,
    required OutfitAnalysisMode mode,
    SkinReport? skin,
  }) async {
    if (!MiraApiConfig.useBackend) {
      throw const VisionPlatformException(
        code: 'VISION_API_DISABLED',
        message: 'Vision Platform requires USE_MIRA_API=true',
        userMessageAr: 'خدمة التحليل غير متاحة حاليًا. حاولي لاحقًا.',
      );
    }

    final result = await _visionApi.analyze(
      imagePath: outfitImage.path,
      occasionId: occasion.id,
      mode: mode.name,
      skinSnapshot: skin != null ? _skinSnapshot(skin) : null,
    );

    if (result == null) {
      throw const VisionPlatformException(
        code: 'VISION_API_EMPTY',
        message: 'Vision API returned empty response',
        userMessageAr: 'تعذّر تحليل الإطلالة. أعيدي التقاط الصورة وحاولي مجددًا.',
      );
    }

    if (result.isBlocked) {
      throw VisionPlatformException(
        code: 'ANALYSIS_BLOCKED',
        message: 'Vision analysisGate=blocked',
        userMessageAr: result.userMessageAr ??
            'تعذّر تحليل الإطلالة بوضوح. أعيدي التقاط الصورة في إضاءة أفضل.',
      );
    }

    return result;
  }

  Map<String, dynamic> _skinSnapshot(SkinReport skin) => {
        'skinType': skin.skinType,
        'undertone': skin.undertone,
        'undertoneEn': skin.undertoneEn,
        'oiliness': skin.oiliness,
        'redness': skin.redness,
        'score': skin.score,
      };

  OutfitVisualProfile _mergeRegionColors(
    OutfitVisualProfile visual,
    OutfitSegmentMap segmentMap,
  ) {
    final garmentColors = _garmentColorsOnly(segmentMap);
    if (garmentColors.isEmpty) {
      return visual.copyWith(dominantColors: const []);
    }
    return visual.copyWith(
      dominantColors: garmentColors,
      clothingTypes: segmentMap.hasTrustedOverlay
          ? segmentMap.regions.map((r) => r.labelAr).toList()
          : visual.clothingTypes,
    );
  }

  List<String> _garmentColorsOnly(OutfitSegmentMap segmentMap) {
    if (segmentMap.garmentPalette.isReliable) {
      final detailed = segmentMap.garmentPalette.detailedColors;
      if (detailed.isNotEmpty) {
        return detailed.map((d) => d.displayNameAr).toList();
      }
      return segmentMap.garmentPalette.ordered;
    }
    final merged = [
      ...segmentMap.upperBodyColors,
      ...segmentMap.lowerBodyColors,
      ...segmentMap.shoeColors,
      ...segmentMap.accessoryColors,
    ];
    return _dedupe(merged).take(5).toList();
  }

  List<String> _piecesFromSegments(
    OutfitSegmentMap segmentMap,
    List<String> fallback,
  ) {
    final labels = segmentMap.regions
        .where((r) =>
            r.zone != OutfitSegmentZone.head &&
            r.zone != OutfitSegmentZone.waist &&
            r.labelAr.isNotEmpty)
        .map((r) => r.labelAr)
        .toList();
    if (labels.isEmpty) return fallback;
    return _dedupe(labels);
  }

  List<String> _piecesNeedingAttention(
    OutfitSegmentMap segmentMap,
    List<String> existing,
  ) {
    final needs = <String>[];
    if (segmentMap.shoeColors.isEmpty) {
      needs.add('الحذاء غير واضح — جرّبي إظهار القدمين داخل الإطار');
    }
    if (segmentMap.upperBodyColors.isEmpty) {
      needs.add('الجزء العلوي غير واضح — تأكدي من إظهار الكتفين');
    }
    return _dedupe([...needs, ...existing]);
  }

  List<String> _dedupe(List<String> values) {
    final seen = <String>{};
    final out = <String>[];
    for (final value in values) {
      final trimmed = value.trim();
      if (trimmed.isEmpty || seen.contains(trimmed)) continue;
      seen.add(trimmed);
      out.add(trimmed);
    }
    return out;
  }
}
