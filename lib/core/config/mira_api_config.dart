/// Mira NestJS backend configuration (Render in production).
///
/// Flow: Flutter → [baseUrl]/ai/skin-analysis → Render → Perfect Corp → JSON back.
/// Perfect Corp API keys live only on Render env vars — never in this app.
abstract final class MiraApiConfig {
  /// `true` = all analysis goes through Render; `false` = on-device mocks only.
  static const bool useBackend = bool.fromEnvironment(
    'USE_MIRA_API',
    defaultValue: true,
  );

  /// Local simulator: http://localhost:3000/api/v1
  /// Render production default below — override with --dart-define for local API.
  static const String baseUrl = String.fromEnvironment(
    'MIRA_API_BASE_URL',
    defaultValue: 'https://mira-api-n4p3.onrender.com/api/v1',
  );
}
