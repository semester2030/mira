# خريطة المسارات الفعلية — مشاهير v1

فرع التنفيذ: `mira/creator-ads-v1` @ `5dc38be` (worktree `mira-wt-creator-ads`).

## باك اند (`mira-api`)

| مسؤولية | ملف / مسار |
|---------|------------|
| مخطط ملف المشهور | `prisma/schema.prisma` → `CreatorProfile`؛ هجرة `20261124190000_creator_profiles` |
| خدمة الملف + الدليل | `src/marketplace/creator-profile.service.ts` |
| واجهات الشريك / العامة | `src/marketplace/creator-profile.controller.ts` |
| وسائط الإعلان المستقلة | `src/marketplace/catalog-ad-media.service.ts` (`ownerKind=ad`) |
| ربط الإعلان + النشر | `src/marketplace/catalog-ad.service.ts` (يستدعي `publishAllForAd` / `publicMediaForAd`) |
| بث وسائط ad | `src/marketplace/catalog-media.controller.ts` (فرع `ownerKind === 'ad'`) |
| تسجيل الوحدة | `marketplace.module.ts` + `partners-portal.module.ts` |

### HTTP

- شريك: `PUT/GET /partners-portal/creator-profile`، `POST …/avatar`
- شريك: `GET /partners-portal/ad-offer-targets`، `GET/POST /partners-portal/ads/:id/media`، ترتيب/غلاف/حذف
- عام: `GET /marketplace/creators?cursor&limit`، `GET /marketplace/creators/:id`، `GET …/avatar`
- عام: `GET /marketplace/ads/:id` (وسائط المشهور أولًا، وإلا وسائط العرض القديمة)

سياسة الوسائط: `MAIN_MAX_VIDEOS=3`، `MAIN_MAX_IMAGES=10` في `catalog-content.policy.ts` (نفس سقف المنتجات).

## بوابة الشركاء (`partners-portal/web`)

| مسؤولية | أين تغيّر |
|---------|-----------|
| مدخل «حساب المشهور» | `js/portal-shell.js` (`creator` view) + `#creatorSection` في `dashboard.html` |
| تسجيل/معاينة الملف | `js/creator-profile.js` |
| اختيار العرض + وسائط الإعلان | `js/ads.js` + `js/api.js` (`adOfferTargets`, `addAdMedia*`) |

## Flutter

| مسؤولية | أين تغيّر |
|---------|-----------|
| دائرة الرئيسية فوق «اكتشفي عالم ميرا» | `lib/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart` |
| أصل الصورة | `assets/marketplace/discover/home_orbit/celebrities_home.jpg` |
| دليل / صفحة / مشغّل | `screens/celebrities_directory_screen.dart`، `celebrity_profile_screen.dart`، `celebrity_ad_player_screen.dart` |
| مسارات | `AppRoutes.celebritiesDirectory` / `celebrityProfile` في `marketplace_routes.dart` |
| شكل الدوائر | `celebrity_avatar_orb.dart` + حدود/ظل في `mira_world_orbit_discover.dart` |

## صلاحية النشر

- حساب `developer`: `submit` ينشر مباشرة (`reviewedBy: developer`).
- غير المطوّر: `in_review` ثم اعتماد إداري ينشر الوسائط عبر `publishAllForAd`.

## إسناد المبيعات/الحجوزات (حالة التسليم)

- مفعّل: تسجيل `link_open` فقط عبر `POST /marketplace/ads/:id/link-open`.
- غير مفعّل في هذه النسخة: `purchaseCompleted` / إسناد طلب أو حجز إلى `adId` (يبقى `false` في عقد الإعلان العام).

## اختبار معزول

```bash
cd mira-api
npx ts-node src/marketplace/creator-ads.v1.http.integration-tests.ts
```

يتطلب `DATABASE_URL` محليًا + تطبيق هجرة `creator_profiles`.
