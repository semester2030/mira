import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/entities/consultation_entities.dart';
import '../consultation_api_endpoints.dart';

class ConsultationApiDataSource {
  final Dio _dio;

  ConsultationApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<ConsultationSession> createSession({
    String? skinAnalysisId,
    String? outfitAnalysisId,
    String? recolorAttemptId,
    String? occasionId,
    String? statedGoalAr,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ConsultationApiEndpoints.sessions(),
      data: {
        if (skinAnalysisId != null && skinAnalysisId.isNotEmpty)
          'skinAnalysisId': skinAnalysisId,
        if (outfitAnalysisId != null && outfitAnalysisId.isNotEmpty)
          'outfitAnalysisId': outfitAnalysisId,
        if (recolorAttemptId != null && recolorAttemptId.isNotEmpty)
          'recolorAttemptId': recolorAttemptId,
        if (occasionId != null && occasionId.isNotEmpty) 'occasionId': occasionId,
        if (statedGoalAr != null && statedGoalAr.isNotEmpty)
          'statedGoalAr': statedGoalAr,
        'locale': 'ar',
      },
    );
    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من محرك الاستشارة');
    return ConsultationSession.fromJson(data);
  }

  Future<ConsultationSession> bindContext({
    required String sessionId,
    String? skinAnalysisId,
    String? outfitAnalysisId,
    String? occasionId,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '${ConsultationApiEndpoints.sessions()}/$sessionId/context',
      data: {
        if (skinAnalysisId != null && skinAnalysisId.isNotEmpty)
          'skinAnalysisId': skinAnalysisId,
        if (outfitAnalysisId != null && outfitAnalysisId.isNotEmpty)
          'outfitAnalysisId': outfitAnalysisId,
        if (occasionId != null && occasionId.isNotEmpty) 'occasionId': occasionId,
      },
    );
    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من محرك الاستشارة');
    return ConsultationSession.fromJson(data);
  }

  Future<ConsultationTurn> sendMessage({
    required String sessionId,
    required String message,
    String? contextSnapshotId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ConsultationApiEndpoints.sessionMessages(sessionId),
      data: {
        'message': message,
        if (contextSnapshotId != null && contextSnapshotId.isNotEmpty)
          'contextSnapshotId': contextSnapshotId,
      },
    );
    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من محرك الاستشارة');
    return ConsultationTurn.fromJson(data);
  }
}
