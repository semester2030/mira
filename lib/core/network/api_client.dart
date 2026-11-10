import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../config/mira_api_config.dart';

/// HTTP client for Mira NestJS API with Firebase ID token injection.
class ApiClient {
  ApiClient._();

  static Dio? _dio;

  /// Test-only override (widget/HTTP acceptance). When set, [instance] returns it
  /// and skips Firebase auth interceptors.
  static Dio? debugDioOverride;

  static Dio get instance {
    if (debugDioOverride != null) return debugDioOverride!;
    _dio ??= _createDio();
    return _dio!;
  }

  static Dio _createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: MiraApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          try {
            final user = FirebaseAuth.instance.currentUser;
            if (user != null) {
              final token = await user.getIdToken();
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {
            // Firebase may be uninitialized in widget/HTTP acceptance tests.
          }
          handler.next(options);
        },
      ),
    );

    return dio;
  }

  /// Resets client (e.g. after logout or env change).
  static void reset() {
    _dio?.close();
    _dio = null;
    debugDioOverride = null;
  }
}
