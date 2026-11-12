# جمالك — بوابة إغلاق محلي

**قرار الإغلاق:** `NOT_CLOSED` — سلسلة الهوية (تسجيل→اعتماد→نشر→حجز→ظهور عند الشريك) **مُثبَّتة على API** (`PASS_CONNECTED`) + حمولات مكان الحجز في Flutter widget (`PASS_FLUTTER_WIDGET_CHAIN`) + بوابة apply بالأنشطة الصحيحة. يبقى Discover على المحاكي (ضغط أيقونة صبغة/استشوار وفيديو العيادة) **NOT_VERIFIED**.  
**لا نشر إنتاج.**  
**رمز الجوال مؤجّل — ليس مانع إغلاق.**

**worktree:** `/Users/fayez/Desktop/mira-wt/elegance-e1` → `/Users/fayez/Desktop/مراجع تطبيق ميرا /mira-wt/elegance-e1`  
**فرع:** `mira/elegance-e1-taxonomy-foundation`  
**test API:** `http://127.0.0.1:3011/api/v1`  
**تشغيل API لهذه الجولة:** بعد `npx nest build` + `node dist/main.js` مع `.env.jamalak-test` (PORT=3011)  
**gitHead عند أدلة البوابة/المتصل:** `01958d7` (قبل commit الإغلاق الحالي)

| المانع | الإصلاح | الاختبار الفعلي | الدليل / runId | الحالة |
|--------|---------|-----------------|----------------|--------|
| OTP عند التسجيل | أُزيلت UI والرموز؛ رسالة قيد مراجعة الإدارة | `jamalak-dual-reg-journey` | `jamalak-2026-11-12T11-35-56-155Z-eb04d4` | **PASS** |
| اعتماد خاطئ من أول صف | decide بـ `requestId` الناتج عن التسجيل | dual-reg + admin-review + partial | `admin-review-2026-11-12T11-35-55-657Z-4a48` / `partial-mwdh23mh-f565` | **PASS** |
| تفعيل تلقائي / إعادة رمز تتبّع بالبريد | `PARTNER_AUTO_APPROVE` يُتجاهل؛ كل apply ينشئ طلبًا و`statusToken` جديدين | `jamalak-admin-review` (duplicate email) | `admin-review-2026-11-12T11-35-55-657Z-4a48` | **PASS** |
| موافقة جزئية / توسيع | اعتماد سطر واحد؛ expand معلّق؛ ACTIVITY_NOT_APPROVED | `jamalak-partial-expand` | `partial-mwdh23mh-f565` | **PASS** |
| تسريب جوال التسجيل | `publicContactPhone` على كتالوج/شريك/خدمة | partial + place | privacyPhone=null | **PASS** |
| فلتر مقر vs موقعك | تغطية جدة بلا فرع جدة؛ فرع الرياض | `jamalak-place-booking` | `place-2026-11-12T11-35-57-111Z-1e27` | **PASS** |
| حجز يحفظ فرع/زيارة + ناقص/فرع خاطئ/تداخل مقر→زيارة | أعمدة place*؛ PLACE_REQUIRED؛ BRANCH_NOT_FOR_SERVICE؛ overlap home بعد branch؛ ACTIVITY_NOT_APPROVED عند المنح | `jamalak-place-booking-create` | `pbk-mwdh1r2e-3d1e` | **PASS** |
| Flutter يرسل مكان الحجز | createBooking + شاشة الموعد | `booking_request_screen_test` + `jamalak_connected_flutter_chain_test` | widget | **PASS (widget chain)** / Discover محاكي **NOT_VERIFIED** |
| إزالة alias lists من Flutter | `beauty_id_compat.dart` مرآة لـ API | `beauty_id_compat_test` | unit | **PASS (unit)** |
| فيديو عيادة → خدمات عربية | linkedServices؛ مسودة/أجنبي missing | `jamalak-clinic-video` + Flutter clinic picker | `clinic-vid-mwdh24cv-6ed7` + flutter-chain | **PASS (API+widget)** / Discover+احجزي محاكي **NOT_VERIFIED** |
| أيقونة صبغة/استشوار → offerId | عروض منشورة + subcategory leaf | `jamalak-color-blowdry-publish` + connected salon | `cb-…-28c3` / `conn-mwdhqidk-52a6` | **PASS (API catalog+connected)** / ضغط أيقونة محاكي **NOT_VERIFIED** |
| بوابة apply مستقلة/صالون/عيادة بلا OTP | Playwright: أنشطة صالون color+blowdry؛ عيادة skin_eval+laser.hair | `jamalak-ui-portal-journeys` | `ui-portal-mwdhrm1l-a5d2` (سابقاً `…-8a03` ناقص أنشطة) | **PASS (portal UI)** |
| سلسلة هوية واحدة apply→approve→publish→book→partner | Scripted Firebase + live partner bookings على نفس DB | `jamalak-connected-journeys` | `conn-mwdhqidk-52a6` (`sameIdentityProven: true`) | **PASS_CONNECTED** |
| `bothUnderHairParent: false` | استعلام الأب لم يُرجع الاثنين؛ استعلام leaf يعزل كل عرض | connected salon note | leaf OK — ليس ترقيم صفحات على leaf | **موثّق** |
| 3 رحلات Flutter Discover كاملة | محاكي على نفس API | — | — | **NOT_VERIFIED** (widget chain PASS) |
| رمز الجوال | مؤجّل عمدًا | — | — | **ليس مانع** |

## سلاسل متصلة (معرّفات)

| الرحلة | طلب التسجيل | اعتماد | عرض/خدمة | حجز عميلة | ظهور عند الشريك |
|--------|-------------|--------|----------|-----------|-----------------|
| مستقلة | `41292fe6-…` | partner `60e8fb4c-…` | service `4a0c390b-…` | booking `f7ee2876-…` home جدة | `partnerSeesBooking: true` |
| صالون | `ebd334de-…` | activities color+blowdry | offers `c0c34d1d-…` / `ad3e5795-…` | branch `59dc2664-…` + home `c9735633-…` رسوم 50 ر.س | `partnerSeesBoth: true` |
| عيادة | `4bc2a0a6-…` | skin_eval+laser.hair | intro `72409213-…` + جلسة بشرة/ليزر | booking `d11f0ead-…` | `partnerSeesBooking: true` |

بوابة UI (لقطات أنشطة صحيحة): `docs/jamalak-dual-reg/evidence/ui-portal-mwdhrm1l-a5d2/`

## أوامر إعادة الاختبار

```bash
cd "/Users/fayez/Desktop/مراجع تطبيق ميرا /mira-wt/elegance-e1/mira-api"
set -a && source .env.jamalak-test && set +a
npx nest build && PORT=3011 node dist/main.js &
export MIRA_API_BASE=http://127.0.0.1:3011/api/v1
npx tsx src/marketplace/taxonomy/jamalak-admin-review.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-dual-reg-journey.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-partial-expand.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-place-booking.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-place-booking-create.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-clinic-video.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-color-blowdry-publish.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-ui-portal-journeys.browser.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-connected-journeys.http.integration-tests.ts
cd .. && flutter test test/features/marketplace/jamalak_connected_flutter_chain_test.dart
```

## ما يلزم لإعلان CLOSED_VERIFIED_LOCAL

1. ~~تشغيل بوابة الشركاء: تسجيل مستقلة + صالون + عيادة بلا OTP، مع لقطات الأنشطة الصحيحة.~~ ← `ui-portal-mwdhrm1l-a5d2`
2. ~~سلسلة هوية API: اعتماد→نشر→حجز→قائمة الشريك لنفس الـpartnerId.~~ ← `conn-mwdhqidk-52a6`
3. ~~Flutter widget: حمولات home/branch + منتقي عيادة عربي.~~ ← `FLUTTER_CHAIN_SUMMARY.json`
4. متبقٍ: محاكي Discover — ضغط أيقونتي الصبغة/الاستشوار ومطابقة `offerId`؛ فتح فيديو العيادة→احجزي.
