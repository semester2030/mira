# أحكام المرحلتين 2 و3 — تصحيح نهائي فوق 2a70887

| المرحلة | الحكم | ملاحظة |
|---|---|---|
| Phase 1 | `OPEN_DEFERRED_BY_OWNER` | البنود الثلاثة مؤجلة بقرار المالك؛ لم تُصلَح هنا |
| Phase 2 | `PASS_LOCAL` | الصور الـ15 محفوظة؛ تحميل بوابة محلي HTTP أثبت categoryId/imageKey/PNG لكل عنصر |
| Phase 3 | `PASS_LOCAL` | مدار الرئيسية مطابقة للمرجع (نسب/حلقة/أناقتك ملابس)؛ 6 نقرات تفتح DiscoverPresentationScreen بالمعرّف الصحيح؛ لقطات 320 و390 |

## بيئة الاختبار
- Flutter widget test + golden على macOS
- بوابة: خادم HTTP محلي يخدم `partners-portal/web` (مسارات e2b-ref/orbs كما في المحرّر)
- الأمر: `flutter test test/features/marketplace/phase2_3_orbit_and_orbs_test.dart`
- الأمر: `node docs/phase2_3/evidence/verify_portal_orbs.mjs`

## ما تغيّر في هذه الجولة
1. `MiraWorldOrbitDiscover`: خط المدار، نسبة الوسط 1.25، أصول home لأناقتك
2. `MarketplaceRoutes`: لا يسقط معرّف القسم عند وجود `DiscoverLane`
3. اختبارات تنقّل صارمة (تفشل بدون DiscoverPresentationScreen + apiId)
