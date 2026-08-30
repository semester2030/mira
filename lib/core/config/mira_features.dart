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

  /// AT-3 / PROD-FINAL-1 — Build inclusion for Fashion Advisor route.
  /// Default `false`. Release binary may set dart-define true for inclusion.
  /// Runtime server entitlement `fashionAdvisorModeB` is also required
  /// (see usages that AND with [MiraRuntimeEntitlementStore]).
  /// Does NOT alone enable backend Fashion Knowledge Mode B.
  static const bool fashionAdvisorV1 = bool.fromEnvironment(
    'MIRA_FASHION_ADVISOR_V1',
    defaultValue: false,
  );

  /// Phase 9C — Interactive Capture Mirror (guidance + auto-capture via 9B latch).
  /// Default `false` keeps legacy manual capture path unchanged.
  /// QA: `--dart-define=MIRA_FACE_CAPTURE_MIRROR_V1=true`
  static const bool faceCaptureMirrorV1 = bool.fromEnvironment(
    'MIRA_FACE_CAPTURE_MIRROR_V1',
    defaultValue: false,
  );

  /// Phase 9D — Soft Laser / Analysis Motion (decorative post-capture wait).
  /// Default `false` keeps legacy analyzing overlay unchanged.
  /// QA: `--dart-define=MIRA_FACE_ANALYSIS_MOTION_V1=true`
  /// Soft laser does NOT measure the face (Law #41).
  static const bool faceAnalysisMotionV1 = bool.fromEnvironment(
    'MIRA_FACE_ANALYSIS_MOTION_V1',
    defaultValue: false,
  );

  /// Phase 9F — Interactive Result Mirror (executive first surface).
  /// Default `false` keeps legacy / Results V2 entry unchanged.
  /// QA: `--dart-define=MIRA_FACE_RESULT_MIRROR_V1=true`
  /// Consumes 9E projection VMs only — no Face Intelligence recomputation.
  static const bool faceResultMirrorV1 = bool.fromEnvironment(
    'MIRA_FACE_RESULT_MIRROR_V1',
    defaultValue: false,
  );
}
