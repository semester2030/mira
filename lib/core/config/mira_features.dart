/// Feature flags — flip when product decisions are finalized.
abstract final class MiraFeatures {
  MiraFeatures._();

  /// `true` (default) = خلفية ثابتة بدون جزيئات/كرات متحركة — يمنع تعطل iOS على جهاز حقيقي.
  /// فعّلوا الحركة: `--dart-define=MIRA_DELIGHT_UI=true`
  static const bool delightUi = bool.fromEnvironment(
    'MIRA_DELIGHT_UI',
    defaultValue: false,
  );

  /// `false` = كل التحليلات مجانية بلا حدود (الوضع الحالي حتى تقرروا الاشتراك).
  /// `true` = تفعيل الحدود والـ paywall عبر `--dart-define=MIRA_SUBSCRIPTIONS_ENABLED=true`
  static const bool subscriptionsEnabled = bool.fromEnvironment(
    'MIRA_SUBSCRIPTIONS_ENABLED',
    defaultValue: false,
  );
}
