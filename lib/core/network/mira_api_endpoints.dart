/// Relative paths for [ApiClient] (base URL is set on Dio).
abstract final class MiraApiEndpoints {
  static const health = '/health';
  static const me = '/users/me';
  static const skinAnalysis = '/skin-analysis';
  static const skinHistory = '/skin-analysis/history';
  static const outfitAnalysis = '/outfit-analysis';
  static const outfitHistory = '/outfit-analysis/history';
  static const recommendations = '/recommendations';
  static const recommendationsHistory = '/recommendations/history';
  static const subscriptionMe = '/subscriptions/me';
  static const subscriptionDevPremium = '/subscriptions/dev/activate-premium';
  static const feedback = '/feedback';
}
