# جمالك — رحلة التسجيل→الحجز — جدول القبول

**commit:** `15f4435` (+follow-up journey assert fix if present)  
**runId (API journey):** `jamalak-2026-11-12T03-03-38-596Z-11f524`  
**test API:** `http://127.0.0.1:3011/api/v1` (local, not production)  
**لا نشر إنتاج في هذه الجولة.**

| الخلل | الإصلاح | الاختبار | الدليل | الحالة |
|--------|---------|----------|--------|--------|
| OTP يقول «أُرسل» بلا مزوّد | `partner-otp-sms.ts` + `PARTNER_OTP_SMS_MODE`؛ فشل الإرسال = خطأ | outbox deliver + reject بدون mode + رمز خاطئ | `partner-otp-sms.schema-tests`؛ HTTP journey phone/email OTP PASS | **PASS** |
| `getPartner` يسرّب `contactPhone` | `publicContactPhone()` موحّد لكل الاستجابات العامة | GET partner بعد كتالوج | `contactPhone= None` على الشريك المختبر | **PASS** |
| `either` يطابق مدينة المقر عند «في موقعك» | `serviceCityMatchesPlaceIntent` — home→تغطية، branch→فرع | schema either الرياض/جدة | `dual-registration.schema-tests` eitherJeddahHome | **PASS** |
| زر احجزي من الفيديو يتجاوز اختيار الخدمة | `openServiceBookingFlow` مشترك discover+detail + أسماء عربية | مراجعة الكود + بناء | `intro_video_booking.dart`؛ لا لقطة جهاز | **PASS (كود) / Flutter UI NOT_VERIFIED** |
| ربط صبغة/استشوار أيقونة→عرض | منطق الربط السابق + اختبارات schema | catalog leaf queries على خادم الاختبار | n=0 عروض منشورة تحت الأوراق في DB الاختبار | **NOT_VERIFIED** — لا عروض صبغة/استشوار منشورة من محرر البوابة في هذه الجولة على خادم الاختبار |
| مختصّة مستقلة تسجيل→حجز من Flutter | apply+OTP+decide على API | HTTP journey | apply 201 + decide 201 | **PARTIAL** — API PASS؛ **حجز Flutter NOT_VERIFIED** |
| صالون مقر+موقع عميلة من البوابة→التطبيق | either coverage schema + محرر | schema | either cross-city PASS | **PARTIAL** — لا رحلة بوابة UI→Flutter على الجهاز |
| عيادة فيديو عام/خاص من احجزي | unified booking + linkedServices عربي | كود + API linkedServices | لا تسجيل شاشة على iPhone | **NOT_VERIFIED** للجهاز |

## أوامر إعادة الاختبار

```bash
cd mira-api
# schema
npx tsx src/partners-portal/partner-otp-sms.schema-tests.ts
npx tsx src/partners-portal/partner-activities/dual-registration.schema-tests.ts
npm run test:beauty-a

# API journey (server must run with PARTNER_OTP_SMS_MODE=outbox)
MIRA_API_BASE=http://127.0.0.1:3011/api/v1 ADMIN_API_KEY=… \
  npx tsx src/marketplace/taxonomy/jamalak-dual-reg-journey.http.integration-tests.ts
```

## موانع الإغلاق

1. لم تُنفَّذ ثلاث رحلات مستخدم كاملة من **بوابة المتصفح** إلى **Flutter على الجهاز** مع لقطات حجز (الجهاز اللاسلكي متاح لكن الرحلة التفاعلية لم تُغلق في هذه الجولة).
2. لا عروض صبغة/استشوار منشورة على خادم الاختبار لإثبات `offerId` لكل دائرة من التطبيق.
3. مزوّد SMS الإنتاج يحتاج `PARTNER_OTP_SMS_MODE=http` + `PARTNER_OTP_SMS_URL` — الاختبار استخدم `outbox` فقط.
