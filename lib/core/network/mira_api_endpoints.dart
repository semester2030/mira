/// Relative paths for [ApiClient] (base URL is set on Dio).
abstract final class MiraApiEndpoints {
  static const health = '/health';
  static const me = '/users/me';
  static const mePreferences = '/users/me/preferences';
  static const entitlementsRuntime = '/entitlements/runtime';
  static const intelligenceProgress = '/intelligence/progress';
  static const advisorChat = '/advisor/chat';
  static const consultationSessions = '/consultation/sessions';
  static String consultationMessages(String sessionId) =>
      '/consultation/sessions/$sessionId/messages';
  /// Flutter → Render only (Render → Perfect Corp). Do not call Perfect Corp from the app.
  static const skinAnalysis = '/ai/skin-analysis';
  static const skinHistory = '/skin-analysis/history';
  static const outfitAnalysis = '/ai/outfit-analysis';
  static const outfitIntelligence = '/ai/outfit-intelligence';
  static const outfitSegmentation = '/ai/outfit-segmentation';
  /// Vision Platform — official outfit vision pipeline (Phase 2+).
  static const visionOutfitAnalyze = '/ai/vision/outfit/analyze';
  /// Garment recolor — FASHN Edit (Phase A). Reference: docs/mira-garment-recolor.html
  static const visionOutfitRecolor = '/ai/vision/outfit/recolor';
  static const outfitHistory = '/outfit-analysis/history';
  static const outfitSnapshots = '/outfit-analysis/snapshots';
  static String consultationContext(String sessionId) =>
      '/consultation/sessions/$sessionId/context';
  static const recommendations = '/recommendations';
  static const recommendationsHistory = '/recommendations/history';
  static const subscriptionMe = '/subscriptions/me';
  static const subscriptionDevPremium = '/subscriptions/dev/activate-premium';
  static const feedback = '/feedback';
  static const marketplaceMatch = '/marketplace/match';
  static const marketplacePartners = '/marketplace/partners';
  static const partnersPortalTrack = '/partners-portal/track';
}
