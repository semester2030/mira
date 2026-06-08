import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../data/mappers/mira_beauty_report_mapper.dart';
import '../../domain/entities/progress_forecast.dart';

class ProgressApiDataSource {
  final Dio _dio;

  ProgressApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<ProgressForecast> fetchProgress() async {
    final response = await _dio.get<Map<String, dynamic>>(
      MiraApiEndpoints.intelligenceProgress,
    );
    return MiraBeautyReportMapper.parseProgressForecast(response.data);
  }
}
