import 'package:dio/dio.dart';

import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
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
      );

      final data = response.data;
      if (data == null) throw Exception('استجابة فارغة من الخادم');

      final outfitJson = data['outfit'] as Map<String, dynamic>?;
      if (outfitJson == null) throw Exception('تنسيق استجابة الإطلالة غير صالح');

      final result = _parseOutfitResult(outfitJson, occasion);
      final id = data['id'] as String?;
      final createdAtRaw = data['createdAt'] as String?;
      final createdAt = createdAtRaw != null ? DateTime.tryParse(createdAtRaw) : null;

      return OutfitResultMapper.toReport(
        result,
        id: id,
        createdAt: createdAt ?? DateTime.now(),
      );
    } finally {
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }

  Future<List<OutfitReport>> fetchHistory({int limit = 50}) async {
    final response = await _dio.get<List<dynamic>>(
      MiraApiEndpoints.outfitHistory,
      queryParameters: {'limit': limit},
    );

    final list = response.data ?? [];
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final outfitJson = map['outfit'] as Map<String, dynamic>;
      final occasionId = map['occasionId'] as String? ?? 'casual';
      final occasion = MiraOccasion.fromId(occasionId) ?? MiraOccasion.casual;
      final result = _parseOutfitResult(outfitJson, occasion);
      return OutfitResultMapper.toReport(
        result,
        id: map['id'] as String,
        createdAt: DateTime.tryParse(map['createdAt'] as String? ?? ''),
      );
    }).toList();
  }

  OutfitAnalysisResult _parseOutfitResult(
    Map<String, dynamic> json,
    MiraOccasion fallbackOccasion,
  ) {
    final occasionId = json['occasion'] as String? ?? fallbackOccasion.id;
    final occasion = MiraOccasion.fromId(occasionId) ?? fallbackOccasion;

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
    );
  }
}
