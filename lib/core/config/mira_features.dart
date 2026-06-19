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

  /// StoreKit / RevenueCat wired — keep false until IAP is App Review ready (PKG-C).
  static const bool storeKitEnabled = bool.fromEnvironment(
    'MIRA_STORE_KIT_ENABLED',
    defaultValue: false,
  );

  /// Paywall + purchase CTAs — requires both subscription flag and real IAP.
  static bool get showSubscriptionPurchaseUi =>
      subscriptionsEnabled && storeKitEnabled;

  /// Subscription management screen (usage, status) without purchase UI.
  static bool get showSubscriptionManagementUi => subscriptionsEnabled;

  /// `false` = كل التحليلات مجانية (الوضع الافتراضي).
  /// `true` = باقات الرصيد (Skin + Smart Outfit) عبر `--dart-define=MIRA_PACKAGES_ENABLED=true`
  static const bool packagesEnabled = bool.fromEnvironment(
    'MIRA_PACKAGES_ENABLED',
    defaultValue: false,
  );

  /// `false` = إخفاء الشركاء (منتجات · صالونات · عيادات) — «الانطلاق قريباً».
  /// `true` = تفعيل Discover والـ marketplace عبر `--dart-define=MIRA_MARKETPLACE_ENABLED=true`
  static const bool marketplaceEnabled = bool.fromEnvironment(
    'MIRA_MARKETPLACE_ENABLED',
    defaultValue: false,
  );
}
