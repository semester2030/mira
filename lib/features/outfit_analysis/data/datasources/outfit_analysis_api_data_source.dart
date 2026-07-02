import 'package:dio/dio.dart';

import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../intelligence/data/mappers/mira_style_report_mapper.dart';
import '../../../outfit_analysis/domain/entities/outfit_style_metrics.dart';
import '../../domain/entities/outfit_report.dart';

class OutfitAnalysisApiDataSource {
  final Dio _dio;

  OutfitAnalysisApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<OutfitReport> analyze({
    required String imagePath,
    required MiraOccasion occasion,
  }) async {
    try {
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(imagePath, filename: 'outfit.jpg'),
        'occasion': occasion.id,
      });

      final response = await _dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.outfitAnalysis,
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 120),
          receiveTimeout: const Duration(seconds: 120),
        ),
      );

      final data = response.data;
      if (data == null) throw Exception('استجابة فارغة من الخادم');

      return _parseResponse(data, occasion);
    } finally {
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }

  Future<OutfitSnapshotRef> saveIntelligenceSnapshot(Map<String, dynamic> payload) async {
    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.outfitSnapshots,
      data: payload,
    );
    final data = response.data;
    if (data == null) throw Exception('تعذر حفظ لقطة الإطلالة');
    return OutfitSnapshotRef(
      id: data['id'] as String? ?? '',
      occasionId: data['occasionId'] as String? ?? '',
    );
  }

  Future<List<OutfitReport>> fetchHistory({int limit = 50}) async {
    final response = await _dio.get<List<dynamic>>(
      MiraApiEndpoints.outfitHistory,
      queryParameters: {'limit': limit},
    );

    final list = response.data ?? [];
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final occasionId = map['occasionId'] as String? ?? 'casual';
      final occasion = MiraOccasion.fromId(occasionId) ?? MiraOccasion.casual;
      return _parseResponse(map, occasion);
    }).toList();
  }

  OutfitReport _parseResponse(Map<String, dynamic> data, MiraOccasion fallbackOccasion) {
    final outfitJson = data['outfit'] as Map<String, dynamic>?;
    if (outfitJson == null) throw Exception('تنسيق استجابة الإطلالة غير صالح');

    final result = _parseOutfitResult(outfitJson, fallbackOccasion);
    final styleReportJson = data['miraStyleReport'] as Map<String, dynamic>?;
    final styleReport =
        styleReportJson != null ? MiraStyleReportMapper.fromJson(styleReportJson) : null;

    final id = data['id'] as String?;
    final createdAtRaw = data['createdAt'] as String?;
    final createdAt = createdAtRaw != null ? DateTime.tryParse(createdAtRaw) : null;

    return OutfitResultMapper.toReport(
      result,
      id: id,
      createdAt: createdAt ?? DateTime.now(),
      miraStyleReport: styleReport,
    );
  }

  OutfitAnalysisResult _parseOutfitResult(
    Map<String, dynamic> json,
    MiraOccasion fallbackOccasion,
  ) {
    final occasionId = json['occasion'] as String? ?? fallbackOccasion.id;
    final occasion = MiraOccasion.fromId(occasionId) ?? fallbackOccasion;
    final metricsJson = json['styleMetrics'] as Map<String, dynamic>?;

    return OutfitAnalysisResult(
      compatibilityScore: (json['compatibilityScore'] as num).toDouble(),
      dominantColors: (json['dominantColors'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      garmentTypeAr: json['garmentTypeAr'] as String,
      garmentTypeEn: json['garmentTypeEn'] as String,
      styleCategoryAr: json['styleCategoryAr'] as String,
      styleCategoryEn: json['styleCategoryEn'] as String,
      occasionSuitabilityAr: json['occasionSuitabilityAr'] as String,
      occasionSuitabilityEn: json['occasionSuitabilityEn'] as String,
      alternativeColorsAr: (json['alternativeColorsAr'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      alternativeColorsEn: (json['alternativeColorsEn'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      occasion: occasion,
      styleMetrics:
          metricsJson != null ? OutfitStyleMetrics.fromJson(metricsJson) : null,
    );
  }
}

class OutfitSnapshotRef {
  final String id;
  final String occasionId;

  const OutfitSnapshotRef({required this.id, required this.occasionId});
}
