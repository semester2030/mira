import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/fashion_vision_document.dart';

/// Vision Platform gateway — Flutter knows this endpoint only (Phase 2+).
/// Reference: docs/mira-vision-platform.html
class VisionApiDataSource {
  VisionApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  final Dio _dio;

  Future<VisionOutfitAnalyzeResult?> analyze({
    required String imagePath,
    required String occasionId,
    required String mode,
    Map<String, dynamic>? skinSnapshot,
    String locale = 'ar',
  }) async {
    if (!MiraApiConfig.useBackend) return null;

    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath, filename: 'outfit.jpg'),
      'occasionId': occasionId,
      'mode': mode,
      'locale': locale,
      if (skinSnapshot != null)
        'skinSnapshot': jsonEncode(skinSnapshot),
    });

    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.visionOutfitAnalyze,
      data: formData,
      options: Options(
        sendTimeout: const Duration(seconds: 90),
        receiveTimeout: const Duration(seconds: 90),
      ),
    );

    final data = response.data;
    if (data == null) return null;
    return VisionOutfitAnalyzeResult.fromJson(data);
  }

  /// FASHN Edit garment recolor — server-side Arabic prompt.
  Future<VisionGarmentRecolorResult?> recolorGarment({
    required String imagePath,
    required String targetColorAr,
    String? targetColorHex,
    String? garmentLabelAr,
    String? customPromptAr,
    String? visionContextJson,
    String locale = 'ar',
  }) async {
    if (!MiraApiConfig.useBackend) return null;

    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath, filename: 'outfit.jpg'),
      'targetColorAr': targetColorAr,
      'locale': locale,
      if (targetColorHex != null) 'targetColorHex': targetColorHex,
      if (garmentLabelAr != null) 'garmentLabelAr': garmentLabelAr,
      if (customPromptAr != null && customPromptAr.trim().isNotEmpty)
        'customPromptAr': customPromptAr.trim(),
      if (visionContextJson != null && visionContextJson.trim().isNotEmpty)
        'visionContext': visionContextJson.trim(),
    });

    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.visionOutfitRecolor,
      data: formData,
      options: Options(
        connectTimeout: const Duration(seconds: 45),
        sendTimeout: const Duration(seconds: 180),
        receiveTimeout: const Duration(seconds: 180),
      ),
    );

    final data = response.data;
    if (data == null) return null;
    return VisionGarmentRecolorResult.fromJson(data);
  }
}

class VisionGarmentRecolorResult {
  final String imageBase64;
  final String mimeType;
  final String promptAr;
  final String userMessageAr;
  final String targetColorAr;
  final String garmentLabelAr;
  final int processingMs;
  final VisionGarmentQelResult? qel;
  final int attempt;

  const VisionGarmentRecolorResult({
    required this.imageBase64,
    required this.mimeType,
    required this.promptAr,
    required this.userMessageAr,
    required this.targetColorAr,
    required this.garmentLabelAr,
    required this.processingMs,
    this.qel,
    this.attempt = 1,
  });

  factory VisionGarmentRecolorResult.fromJson(Map<String, dynamic> json) {
    return VisionGarmentRecolorResult(
      imageBase64: json['imageBase64'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? 'image/jpeg',
      promptAr: json['promptAr'] as String? ?? '',
      userMessageAr: json['userMessageAr'] as String? ?? '',
      targetColorAr: json['targetColorAr'] as String? ?? '',
      garmentLabelAr: json['garmentLabelAr'] as String? ?? '',
      processingMs: (json['processingMs'] as num?)?.toInt() ?? 0,
      qel: json['qel'] is Map<String, dynamic>
          ? VisionGarmentQelResult.fromJson(json['qel'] as Map<String, dynamic>)
          : null,
      attempt: (json['attempt'] as num?)?.toInt() ?? 1,
    );
  }
}

class VisionGarmentQelResult {
  final bool accepted;
  final double weightedScore;
  final double threshold;
  final bool? cropFirst;
  final String? calibrationProfile;

  const VisionGarmentQelResult({
    required this.accepted,
    required this.weightedScore,
    required this.threshold,
    this.cropFirst,
    this.calibrationProfile,
  });

  factory VisionGarmentQelResult.fromJson(Map<String, dynamic> json) {
    return VisionGarmentQelResult(
      accepted: json['accepted'] as bool? ?? false,
      weightedScore: (json['weightedScore'] as num?)?.toDouble() ?? 0,
      threshold: (json['threshold'] as num?)?.toDouble() ?? 0.85,
      cropFirst: json['cropFirst'] as bool?,
      calibrationProfile: json['calibrationProfile'] as String?,
    );
  }

  int get scorePercent => (weightedScore * 100).round();
}
