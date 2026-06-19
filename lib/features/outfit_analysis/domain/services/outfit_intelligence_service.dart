import 'dart:developer' as developer;
import 'dart:io';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../data/services/outfit_analysis_cache_service.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_analysis_mode.dart';
import '../entities/outfit_segment_map.dart';
import '../entities/user_gender.dart';
import '../entities/outfit_visual_profile.dart';
import 'deterministic_outfit_engine.dart';
import 'google_vision_outfit_service.dart';
import 'outfit_image_analyzer.dart';
import 'outfit_segmentation_service.dart';

/// Capture → Vision → body map → segment colors → deterministic scoring.
class OutfitIntelligenceService {
  OutfitIntelligenceService({
    GoogleVisionOutfitService? visionService,
    OutfitAnalysisCacheService? cacheService,
    OutfitSegmentationService? segmentationService,
  })  : _vision = visionService ?? GoogleVisionOutfitService(),
        _cache = cacheService,
        _segmentation = segmentationService ?? OutfitSegmentationService();

  final GoogleVisionOutfitService _vision;
  final OutfitAnalysisCacheService? _cache;
  final OutfitSegmentationService _segmentation;

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
      return cached.analysis.copyWith(frozenImagePath: outfitImage.path);
    }

    final resolved = await _resolveVisualWithObjects(outfitImage);
    final segmentMap = await _segmentation.buildFromFrozenImage(
      outfitImage,
      visual: resolved.profile,
      visionObjects: resolved.localizedObjects,
    );

    final visual = _mergeRegionColors(resolved.profile, segmentMap);
    final analysis = DeterministicOutfitEngine.analyze(
      skin: skin,
      visual: visual,
      occasion: occasion,
      mode: mode,
      gender: gender ?? AnalysisSession.userGender,
    );

    final enriched = analysis.copyWith(
      frozenImagePath: outfitImage.path,
      segmentMap: segmentMap,
      upperBodyColors: segmentMap.upperBodyColors,
      lowerBodyColors: segmentMap.lowerBodyColors,
      shoeColors: segmentMap.shoeColors,
      accessoryColors: segmentMap.accessoryColors,
      dominantColors: _dominantFromSegments(segmentMap, visual.dominantColors),
      detectedPieces: _piecesFromSegments(segmentMap, analysis.detectedPieces),
      mismatchReasons: _piecesNeedingAttention(segmentMap, analysis.mismatchReasons),
    );

    await cache.put(key: cacheKey, visual: visual, analysis: enriched);
    return enriched;
  }

  Future<OutfitVisionResult> _resolveVisualWithObjects(File outfitImage) async {
    try {
      return await _vision.analyzeWithObjects(outfitImage);
    } catch (error, stack) {
      developer.log(
        'Google Vision failed — deterministic visual fallback',
        error: error,
        stackTrace: stack,
        name: 'OutfitIntelligenceService',
      );
    }

    try {
      final profile = await OutfitImageAnalyzer.analyze(outfitImage);
      return OutfitVisionResult(profile: profile);
    } catch (error, stack) {
      developer.log(
        'Deterministic visual analyzer failed',
        error: error,
        stackTrace: stack,
        name: 'OutfitIntelligenceService',
      );
      rethrow;
    }
  }

  OutfitVisualProfile _mergeRegionColors(
    OutfitVisualProfile visual,
    OutfitSegmentMap segmentMap,
  ) {
    final regionColors = [
      ...segmentMap.upperBodyColors,
      ...segmentMap.lowerBodyColors,
      ...segmentMap.shoeColors,
      ...segmentMap.accessoryColors,
    ];
    if (regionColors.isEmpty) return visual;
    return visual.copyWith(
      dominantColors: _dedupe([...regionColors, ...visual.dominantColors]).take(6).toList(),
    );
  }

  List<String> _dominantFromSegments(
    OutfitSegmentMap segmentMap,
    List<String> fallback,
  ) {
    final merged = [
      ...segmentMap.upperBodyColors,
      ...segmentMap.lowerBodyColors,
      ...segmentMap.shoeColors,
    ];
    if (merged.isEmpty) return fallback;
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
