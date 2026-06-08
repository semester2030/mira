import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/user_preferences.dart';

class UserApiDataSource {
  final Dio _dio;

  UserApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<void> deleteAccount() async {
    await _dio.delete<void>(MiraApiEndpoints.me);
  }

  Future<UserPreferences> getPreferences() async {
    final response = await _dio.get<Map<String, dynamic>>(
      MiraApiEndpoints.mePreferences,
    );
    return UserPreferences.fromJson(response.data ?? const {});
  }

  Future<UserPreferences> updatePreferences({int? birthYear}) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      MiraApiEndpoints.mePreferences,
      data: {'birthYear': birthYear},
    );
    return UserPreferences.fromJson(response.data ?? const {});
  }
}
