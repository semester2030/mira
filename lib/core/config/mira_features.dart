/// Feature flags — flip when product decisions are finalized.
abstract final class MiraFeatures {
  MiraFeatures._();

  /// `false` = كل التحليلات مجانية بلا حدود (الوضع الحالي حتى تقرروا الاشتراك).
  /// `true` = تفعيل الحدود والـ paywall عبر `--dart-define=MIRA_SUBSCRIPTIONS_ENABLED=true`
  static const bool subscriptionsEnabled = bool.fromEnvironment(
    'MIRA_SUBSCRIPTIONS_ENABLED',
    defaultValue: false,
  );
}
