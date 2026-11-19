# RC5.1 — إغلاق: الحجز عند انقطاع الرد، وسعر البدائل

## مرجع الإصدار (موحّد — لا تخمين)

| دور | Commit | ملاحظة |
|---|---|---|
| **FEATURE RC5 (معلَن)** | `f7fa162b16b01e1987d1bcf81959d5218144b6fe` | نتيجة الميزة RC5؛ سلف رأس الفرع |
| **TIP قبل RC5.1 / BASE للـpatch** | `c14a84aec8b33037b64313773d304b4258622957` | الرأس الفعلي عند بدء RC5.1 (docs freeze) — ليس FEATURE وحده |
| **RESULT RC5.1 (كود)** | `7a00e305a5e2cc62ba252804026942b42d7e82ea` | آلة الحالات + سباق أول إرسال + فصل سعر البدائل |
| **TIP التسليم** | يُثبَّت في `evidence/rc5.1/raw/ids.txt` و`mira-catalog-provider-rc5.1.SHA256.txt` بعد آخر commit أدلة | يجب أن يطابق البيان الخارجي |

**الفرع:** `mira/catalog-provider-rc1` — لا دمج main / لا إنتاج  
**البيئة المحلية:** `mira_p1_rc7_test@localhost` + Flutter على المضيف

## ما نُفّذ

1. **آلة حالات المحاولة:** `fresh / submitting / outcomeUnknown / accepted / rejectedFinal` — استرجاع بالمفتاح+الحساب قبل أي فحص توفر؛ رفض نهائي لا يُعاد إرساله تلقائيًا؛ لا استبدال مفتاح مجهول عند تغيير اليوم/خدمة أخرى.
2. **تخزين متعدّد:** فهرس SharedPreferences بدون اتصال؛ اتصال/ملاحظات في `flutter_secure_storage`؛ ربط الحذف بالحساب+المفتاح؛ مدخل من «حجوزاتي».
3. **سباق أول إرسال:** قفل الجدول ثم إعادة قراءة المفتاح؛ اختبار first-send same-key + منح نشاط DB (فردي ومتتابع) بلا سجل جزئي.
4. **اسألي ميرا:** فصل نية البدائل/المقارنة عن «بكم هذه؟» قبل معالج السعر/الحجز؛ الدور النهائي = نص + بطاقات (`buildAlternativesConsultationTurn`) مع اكتشاف مفعّل/مطفأ وبعد السحب.

## جدول الحالة / الدليل / ما بقي

| الحالة | الدليل | ما بقي |
|---|---|---|
| (أ) ضياع رد + تحقق بنفس الشاشة قبل التوفر | `flutter_visit_tests.txt` — اختبار (a) | جهاز حقيقي |
| (ب) استرجاع من حجوزاتي بعد إغلاق التطبيق | نفس الملف — اختبار (b) | جهاز حقيقي |
| (ج) رفض نهائي ثم إعادة فتح بلا إرسال | نفس الملف — اختبار (c) | — |
| (د) محاولتان / حسابان بلا اختلاط | نفس الملف — اختبار (d) | — |
| أول إرسال same-key → visit واحد + بندين | `integration_visit_db.txt` (`firstSendSameKeyOk`) | — |
| سباق عميلتين → فائزة واحدة | نفس الملف (`raceWinner:1`) | — |
| ACTIVITY_NOT_APPROVED فردي+متتابع بلا جزئي | نفس الملف (`activityGrantRejected`) | — |
| بكم هذه؟ / بدائل / قارني + بطاقات + سحب + discovery on/off | `schema_offer_price_book.txt` | محادثة حية على الجهاز |
| رحلة بوابة→تطبيق→مركز متصلة | `journey_status.txt` | **بانتظار اختبار فايز على جهاز الاختبار** — `device_test_steps_ar.txt` |
| `npm run build` (nest) | أخطاء taxonomy/AWS قديمة خارج نطاق RC5.1 على هذا المضيف | غير حاجز لقبول الحجز/ميرا هنا |
| مناسبات / مجوهرات / إنتاج | خارج النطاق | — |

## أوامر محلية نُفّذت

```bash
flutter test test/features/marketplace/booking_visit_consecutive_test.dart
DATABASE_URL=postgresql://mira:mira_secret@localhost:5432/mira_p1_rc7_test \
  npx tsx mira-api/src/marketplace/commerce.visit.integration-tests.ts
node --import tsx mira-api/src/consultation/marketplace-offer-price-book.schema-tests.ts
flutter analyze lib/features/marketplace/data/pending_visit_attempt_store.dart \
  lib/features/marketplace/presentation/screens/booking_*.dart \
  lib/features/marketplace/presentation/screens/bookings_list_screen.dart
```

## عيّنة معرّفات تجريبية (ليست عميلات حقيقية)

من `integration_visit_db.txt`: زيارة واحدة + بندين عند الإنشاء؛ `firstSendSameKeyOk:true`؛ `activityGrantRejected:true`؛ `homeOnlyRejected:true`؛ `midTxRollback:true`.
