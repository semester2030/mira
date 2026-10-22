import 'dart:typed_data';

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
    Map<String, dynamic>? face,
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
        if (face != null) 'face': face,
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
    String? statedGoalAr,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '${ConsultationApiEndpoints.sessions()}/$sessionId/context',
      data: {
        if (skinAnalysisId != null && skinAnalysisId.isNotEmpty)
          'skinAnalysisId': skinAnalysisId,
        if (outfitAnalysisId != null && outfitAnalysisId.isNotEmpty)
          'outfitAnalysisId': outfitAnalysisId,
        if (occasionId != null && occasionId.isNotEmpty) 'occasionId': occasionId,
        if (statedGoalAr != null && statedGoalAr.isNotEmpty)
          'statedGoalAr': statedGoalAr,
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

  Future<List<ConsultationSession>> listSessions() async {
    final response = await _dio.get<List<dynamic>>(ConsultationApiEndpoints.sessions());
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ConsultationSession.fromJson)
        .toList();
  }

  Future<({List<ConsultationMessage> messages, String? nextCursor})> listMessages(
    String sessionId, {
    String? before,
    int limit = 50,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ConsultationApiEndpoints.sessionMessages(sessionId),
      queryParameters: {
        'limit': limit,
        if (before != null && before.isNotEmpty) 'before': before,
      },
    );
    final data = response.data ?? const <String, dynamic>{};
    final messages = (data['messages'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ConsultationMessage.fromJson)
        .toList();
    return (messages: messages, nextCursor: data['nextCursor'] as String?);
  }

  Future<void> deleteAttachment(String attachmentId) async {
    await _dio.delete<void>(ConsultationApiEndpoints.attachment(attachmentId));
  }

  Future<int> dialogueImageLimit() async {
    final response = await _dio.get<Map<String, dynamic>>(ConsultationApiEndpoints.limits());
    return response.data?['maxImagesPerMessage'] as int? ?? 3;
  }

  Future<String> uploadAttachment({
    required String sessionId,
    required Uint8List bytes,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ConsultationApiEndpoints.sessionAttachments(sessionId),
      data: FormData.fromMap({
        'image': MultipartFile.fromBytes(bytes, filename: 'chat.jpg'),
      }),
    );
    final id = response.data?['id'] as String?;
    if (id == null || id.isEmpty) {
      throw Exception(response.data?['messageAr'] as String? ?? 'تعذر رفع الصورة');
    }
    return id;
  }

  Future<Uint8List> downloadAttachment(String attachmentId) async {
    final response = await _dio.get<List<int>>(
      ConsultationApiEndpoints.attachment(attachmentId),
      options: Options(responseType: ResponseType.bytes),
    );
    final data = response.data;
    if (data == null || data.isEmpty) throw Exception('تعذر تحميل الصورة');
    return Uint8List.fromList(data);
  }
}
