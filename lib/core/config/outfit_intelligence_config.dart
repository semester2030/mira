/// Outfit intelligence configuration — Flutter-only Google Vision.
///
/// Local dev: `--dart-define=GOOGLE_VISION_API_KEY=YOUR_KEY`
/// Never commit keys. Restrict the key to Cloud Vision API + app bundle IDs.
abstract final class OutfitIntelligenceConfig {
  OutfitIntelligenceConfig._();

  static const googleVisionApiKey = String.fromEnvironment(
    'GOOGLE_VISION_API_KEY',
    defaultValue: '',
  );

  static bool get hasGoogleVision => googleVisionApiKey.trim().isNotEmpty;

  @Deprecated('Use hasGoogleVision')
  static bool get hasLocalGoogleVision => hasGoogleVision;
}
