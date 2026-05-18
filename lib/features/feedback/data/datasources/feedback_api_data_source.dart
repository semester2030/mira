import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';

class FeedbackApiDataSource {
  final Dio _dio;

  FeedbackApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<void> submit({
    required String target,
    int? rating,
    String? comment,
  }) async {
    await _dio.post<void>(
      MiraApiEndpoints.feedback,
      data: {
        'target': target,
        if (rating != null) 'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }
}
