import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_visual_profile.dart';

class OutfitAnalysisCacheEntry {
  final OutfitVisualProfile visual;
  final OutfitAnalysis analysis;

  const OutfitAnalysisCacheEntry({
    required this.visual,
    required this.analysis,
  });
}

/// Caches hybrid analysis by image hash + skin + occasion — avoids repeat billing.
class OutfitAnalysisCacheService {
  static const _prefix = 'mira_outfit_intel_v1_';
  final SharedPreferences _prefs;

  OutfitAnalysisCacheService(this._prefs);

  static Future<OutfitAnalysisCacheService> create() async {
    return OutfitAnalysisCacheService(await SharedPreferences.getInstance());
  }

  Future<String> buildKey({
    required List<int> imageBytes,
    required String skinKey,
    required String occasionId,
    required String modeId,
  }) async {
    final digest = sha256.convert(imageBytes);
    return '$_prefix${digest.toString()}_${skinKey}_${occasionId}_$modeId';
  }

  String skinKeyFromReport({
    required String skinType,
    required String undertone,
    required int oiliness,
    required int redness,
  }) {
    return '${skinType}_${undertone}_${oiliness}_$redness';
  }

  Future<OutfitAnalysisCacheEntry?> get(String key) async {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final occasionId = map['occasionId'] as String? ?? 'casual';
      return OutfitAnalysisCacheEntry(
        visual: OutfitVisualProfile.fromJson(
          map['visual'] as Map<String, dynamic>,
        ),
        analysis: OutfitAnalysis.fromJson(
          map['analysis'] as Map<String, dynamic>,
          occasion: MiraOccasion.fromId(occasionId) ?? MiraOccasion.casual,
        ),
      );
    } catch (_) {
      await _prefs.remove(key);
      return null;
    }
  }

  Future<void> put({
    required String key,
    required OutfitVisualProfile visual,
    required OutfitAnalysis analysis,
  }) async {
    final payload = jsonEncode({
      'occasionId': analysis.occasion.id,
      'visual': visual.toJson(),
      'analysis': _analysisToJson(analysis),
    });
    await _prefs.setString(key, payload);
  }

  Map<String, dynamic> _analysisToJson(OutfitAnalysis a) => {
        'mode': a.mode.name,
        'clothingType': a.clothingType,
        'styleType': a.styleType,
        'dominantColors': a.dominantColors,
        'compatibilityScore': a.compatibilityScore,
        'recommendedColors': a.recommendedColors,
        'rejectedColors': a.rejectedColors,
        'suggestedAccessories': a.suggestedAccessories,
        'suggestedMakeup': a.suggestedMakeup,
        'explanation': a.explanation,
        'confidence': a.confidence,
        'matchReasons': a.matchReasons,
        'mismatchReasons': a.mismatchReasons,
        'recommendations': a.recommendations,
        'styleVerdict': a.styleVerdict,
        'detectedPieces': a.detectedPieces,
        'visionLabels': a.visionLabels,
        'visualConfidence': a.visualConfidence,
        'contrastLevel': a.contrastLevel,
        'formalityLevel': a.formalityLevel,
        'analysisSource': a.analysisSource,
        'visualSource': a.visualSource,
        'skinCompatibilityScore': a.skinCompatibilityScore,
        'occasionMatchScore': a.occasionMatchScore,
        'styleBalanceScore': a.styleBalanceScore,
        'colorHarmonyScore': a.colorHarmonyScore,
      };
}
