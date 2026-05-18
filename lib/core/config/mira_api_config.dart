/// Mira NestJS backend configuration.
abstract final class MiraApiConfig {
  /// Set `true` to route analysis through NestJS instead of local/Firebase-only mocks.
  static const bool useBackend = bool.fromEnvironment(
    'USE_MIRA_API',
    defaultValue: false,
  );

  /// Local dev: http://localhost:3000/api/v1 — production: your deployed API URL.
  static const String baseUrl = String.fromEnvironment(
    'MIRA_API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
}
