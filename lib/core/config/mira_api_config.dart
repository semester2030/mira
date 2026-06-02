/// Mira NestJS backend configuration (Render in production).
///
/// Flow: Flutter → [baseUrl]/ai/skin-analysis → Render → Perfect Corp → JSON back.
/// Perfect Corp API keys live only on Render env vars — never in this app.
abstract final class MiraApiConfig {
  /// `true` = all analysis goes through Render; `false` = on-device mocks only.
  static const bool useBackend = bool.fromEnvironment(
    'USE_MIRA_API',
    defaultValue: false,
  );

  /// Local simulator: http://localhost:3000/api/v1
  /// Render: https://YOUR-SERVICE.onrender.com/api/v1
  /// Physical iPhone: use Mac LAN IP on port 3000 (not localhost)
  static const String baseUrl = String.fromEnvironment(
    'MIRA_API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
}
