import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/advisor_face_context.dart';
import '../../domain/entities/advisor_fashion_context.dart';
import '../../domain/entities/advisor_response.dart';

class AdvisorApiDataSource {
  final Dio _dio;

  AdvisorApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  /// POST /advisor/chat — public AdvisorChatDto fields only.
  Future<AdvisorResponse> chat({
    required String message,
    String? analysisId,
    AdvisorFashionContext? fashion,
    AdvisorFaceContext? face,
  }) async {
    final fashionJson = fashion?.toJson();
    if (fashionJson != null) {
      for (final key in AdvisorFashionContext.forbiddenAuthorityKeys) {
        assert(
          !fashionJson.containsKey(key),
          'Fashion context must not include authority field: $key',
        );
      }
    }
    final faceJson = face?.toJson();
    if (faceJson != null) {
      for (final key in AdvisorFaceContext.forbiddenAuthorityKeys) {
        assert(
          !faceJson.containsKey(key),
          'Face context must not include authority field: $key',
        );
      }
    }

    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.advisorChat,
      data: {
        'message': message,
        if (analysisId != null && analysisId.isNotEmpty)
          'analysisId': analysisId,
        if (fashionJson != null && fashionJson.isNotEmpty) 'fashion': fashionJson,
        if (faceJson != null && faceJson.isNotEmpty) 'face': faceJson,
      },
    );

    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من مستشار ميرا');

    return AdvisorResponse.fromJson(data);
  }
}
