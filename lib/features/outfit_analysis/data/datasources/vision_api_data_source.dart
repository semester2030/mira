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
}
