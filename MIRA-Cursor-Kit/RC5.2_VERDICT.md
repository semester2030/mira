# RC5.2 — إغلاق البناء، ودقة البدائل، واستئناف الحجز بعد الرفض

## مرجع الإصدار

| دور | Commit | ملاحظة |
|---|---|---|
| **BASE / رأس RC5.1** | `87376ececffdbc7f226f0c745db41aeb73a714e0` | بداية فرع الاختبار RC5.2 |
| **RESULT RC5.2 (كود+أدلة داخل المستودع)** | يُثبَّت في `evidence/rc5.2/raw/ids.txt` بعد الـcommit | بدون SHA ذاتي داخل نفس الملف قبل التثبيت |
| **TIP التسليم الخارجي** | `mira-catalog-provider-rc5.2.SHA256.txt` على سطح المكتب | خارج الـcommit — لا دجاجة-بيضة |

**الفرع:** `mira/catalog-provider-rc5.2` — لا دمج main / لا إنتاج  
**البيئة:** `mira_p1_rc7_test@localhost` + خادم اختبار `PORT=3019`

## ما نُفّذ

1. **بناء الإنتاج:** إصلاح عقد `string|null`، إعادة تسمية نوع الدليل، استثناء proof/closure من `tsconfig.build`، `npm ci`/`prisma generate`/`nest build` → خروج 0؛ تشغيل `node dist/main` وفحص `/api/v1/health` = 200.
2. **اسألي ميرا — البديل:** تصنيف «البديل / غيرها / الخدمة الأخرى» قبل سعر العرض المفتوح؛ الدور النهائي يعرض سعر البديل المنشور (120) لا 150؛ بطاقة مغلقة/`inStock:false` → `action: view` فقط.
3. **الرفض النهائي:** إعادة الفتح = صفر إرسال؛ «بدء طلب جديد» بمفتاح جديد = إرسال واحد؛ `getVisitByKey` يعامل فقط `VISIT_NOT_FOUND` كعدم وجود؛ 404 عام = تعذّر تحقق بلا إعادة POST.

## جدول القبول

| الحالة | الدليل | ما بقي |
|---|---|---|
| بناء nest exit 0 + health 200 | `evidence/rc5.2/raw/api_build.txt`, `health.json`, `server_run.txt` | — |
| بكم هذه؟ / بكم البديل؟ / غيرها / قارني + بطاقات | `schema_offer_price_book.txt`, `schema_alternatives_api_turn.txt` | محادثة حية على الجهاز |
| رفض→إعادة فتح صفر إرسال؛ بدء جديد = POST واحد؛ 404 عام صفر إعادة | `flutter_visit_tests.txt` (c,c2,c3) + اختبارات a/b/d السابقة | جهاز |
| رحلة بوابة→تطبيق→مركز | `journey_status.txt` | **بانتظار الجهاز** |

## أوامر محلية

```bash
npm ci && npx prisma generate && npm run build   # nest_exit:0
PORT=3019 node dist/main                         # /api/v1/health → 200
./node_modules/.bin/tsx src/consultation/marketplace-offer-price-book.schema-tests.ts
./node_modules/.bin/tsx src/consultation/rc52-alternatives-api-turn.schema-tests.ts
flutter test test/features/marketplace/booking_visit_consecutive_test.dart
```
