import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/subscription_status.dart';

class SubscriptionApiDataSource {
  final Dio _dio;

  SubscriptionApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<SubscriptionStatus> fetchStatus() async {
    final response = await _dio.get<Map<String, dynamic>>(MiraApiEndpoints.subscriptionMe);
    return SubscriptionStatus.fromJson(response.data ?? {});
  }

  Future<SubscriptionStatus> activatePremiumDev() async {
    if (!kDebugMode) {
      throw Exception('متاح في وضع التطوير فقط');
    }
    await _dio.post<void>(MiraApiEndpoints.subscriptionDevPremium);
    return fetchStatus();
  }
}
