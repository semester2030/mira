import 'package:dio/dio.dart';

import '../../../../core/ai/mappers/skin_result_mapper.dart';
import '../../../../core/ai/models/skin_analysis_result.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/services/user_stats_service.dart';
import '../models/skin_report_model.dart';

/// Calls NestJS `POST /skin-analysis` — images are not stored on device after upload.
class SkinAnalysisApiDataSource {
  final Dio _dio;

  SkinAnalysisApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<SkinReportModel> analyzeAndSave({required String imagePath}) async {
    try {
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(
          imagePath,
          filename: 'scan.jpg',
        ),
      });

      // YouCam polling on the server can take up to ~90s — longer than default Dio timeout.
      final response = await _dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.skinAnalysis,
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 120),
          receiveTimeout: const Duration(seconds: 120),
        ),
      );

      final data = response.data;
      if (data == null) {
        throw Exception('استجابة فارغة من الخادم');
      }

      final skinJson = data['skin'] as Map<String, dynamic>?;
      if (skinJson == null) {
        throw Exception('تنسيق استجابة التحليل غير صالح');
      }

      final result = _parseSkinResult(skinJson);
      final id = data['id'] as String?;
      final createdAtRaw = data['createdAt'] as String?;
      final createdAt = createdAtRaw != null ? DateTime.tryParse(createdAtRaw) : null;

      final report = SkinResultMapper.toReport(
        result,
        id: id,
        createdAt: createdAt ?? DateTime.now(),
      );

      final model = SkinReportModel.fromEntity(report);
      await UserStatsService.recordSkinAnalysis();
      return model;
    } finally {
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }

  Future<List<SkinReportModel>> fetchHistory({int limit = 50}) async {
    final response = await _dio.get<List<dynamic>>(
      MiraApiEndpoints.skinHistory,
      queryParameters: {'limit': limit},
    );

    final list = response.data ?? [];
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final skinJson = map['skin'] as Map<String, dynamic>;
      final result = _parseSkinResult(skinJson);
      final id = map['id'] as String;
      final createdAt = DateTime.tryParse(map['createdAt'] as String? ?? '');
      final report = SkinResultMapper.toReport(
        result,
        id: id,
        createdAt: createdAt,
      );
      return SkinReportModel.fromEntity(report);
    }).toList();
  }

  SkinAnalysisResult _parseSkinResult(Map<String, dynamic> json) {
    return SkinAnalysisResult(
      beautyScore: (json['beautyScore'] as num).toDouble(),
      skinTypeAr: json['skinTypeAr'] as String,
      skinTypeEn: json['skinTypeEn'] as String,
      hydration: (json['hydration'] as num).toInt(),
      oiliness: (json['oiliness'] as num).toInt(),
      pores: (json['pores'] as num).toInt(),
      wrinkles: (json['wrinkles'] as num).toInt(),
      darkSpots: (json['darkSpots'] as num).toInt(),
      acne: (json['acne'] as num).toInt(),
      redness: (json['redness'] as num).toInt(),
      undertoneAr: json['undertoneAr'] as String,
      undertoneEn: json['undertoneEn'] as String,
      skinToneAr: json['skinToneAr'] as String,
      skinToneEn: json['skinToneEn'] as String,
      recommendationsAr: (json['recommendationsAr'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      recommendationsEn: (json['recommendationsEn'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      skinAge: (json['skinAge'] as num?)?.toInt(),
      concernScores: _parseConcernScores(json['concernScores']),
    );
  }

  Map<String, int> _parseConcernScores(dynamic raw) {
    if (raw is! Map) return const {};
    return raw.map(
      (key, value) => MapEntry(
        key.toString(),
        value is num ? value.toInt() : 0,
      ),
    );
  }
}
