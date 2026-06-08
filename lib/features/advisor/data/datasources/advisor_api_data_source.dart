import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/advisor_response.dart';

class AdvisorApiDataSource {
  final Dio _dio;

  AdvisorApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<AdvisorResponse> chat({
    required String message,
    String? analysisId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.advisorChat,
      data: {
        'message': message,
        if (analysisId != null && analysisId.isNotEmpty) 'analysisId': analysisId,
      },
    );

    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من مستشار ميرا');

    return AdvisorResponse.fromJson(data);
  }
}
