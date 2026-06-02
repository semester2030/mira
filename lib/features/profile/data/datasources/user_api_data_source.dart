import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';

class UserApiDataSource {
  final Dio _dio;

  UserApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<void> deleteAccount() async {
    await _dio.delete<void>(MiraApiEndpoints.me);
  }
}
