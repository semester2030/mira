# تسليم تصحيحي بعد مراجعة c98decb

تاريخ: 2026-10-01  
أساس: `c98decb` + ملاحظة النشر `cf72f8a` — التصحيح يُبنى فوقهما دون استبدال أعمال المستخدم.

## مراجعة الحزمة السابقة

| الحقل | القيمة |
| --- | --- |
| الحزمة | `MIRA_COMMERCE_OPERATIONAL_REVIEW_c98decb.zip` |
| نتيجة المراجعة | **تمت المراجعة — يحتاج تصحيحًا واستكمالًا** |
| أسباب الرفض للاعتماد التشغيلي | 8 ملفات فقط، مجلد اختبارات فارغ، نواقص/أخطاء مثبتة في قواعد التوفر ومفاتيح النسخ والحالات والرسوم |

## بطاقة البنود

| ID | المشكلة | التصحيح | الاختبار المنفذ | النتيجة | رابط الدليل | المتبقي |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | نوافذ متداخلة تعرض سعة متناقضة | `assertAvailabilityConsistent` + `capacityCovering` = MIN لا مجموع؛ `resourceId` | `test:commerce-pure` + service/HTTP | PASS محلي | `commerce.types.schema-tests.ts` | إثبات جهاز منشور |
| C2 | تصادم `canonicalVariantKey` بفواصل | ترميز length-prefix؛ تفضيل `variant.id` | pure | PASS | نفس الملف | — |
| C3 | STATUS_MAP vs كود (failed_delivery / collect) | failed_delivery غير نهائي؛ التحصيل بعد delivered فقط | service + HTTP | PASS محلي | `STATUS_MAP.md` | نشر بوابات |
| C4 | أعلى رسم / ack كقرار مالك | رسوم متساوية معروفة؛ رفض المجهول؛ DEC مصحّح | service | PASS محلي | `DEC_0001_OWNER_COD.md` | — |
| C5 | خيارات localStorage / JSON / تجاوز مراجعة | `draftOptions*` + واجهة أيام؛ خيارات عبر المراجعة | migrate + كود | منفّذ | migration `20261001120000` | اختبار متصفح يدوي |
| C6 | إدارة قراءة فقط | تفاصيل + انتقالات + تحصيل + حجوزات | كود UI | منفّذ | `admin-portal/web/js/app.js` | تحقق نشر |
| C7 | مشاركة نصية فقط / مشاهدات | parse deep link `/discover/{kind}/{id}` | `discover_deep_link_test.dart` | PASS وحدة | نفس الاختبار | ربط Universal Links؛ مشاهدات مفتوحة |
| C8 | حزمة رقيقة | حزمة مصدر كاملة (هذا التسليم) | packing script | قيد الإعداد | ZIP النهائي | بصمة بعد الإغلاق |
| C9 | بلا HTTP+DB | `npm run test:commerce` على Postgres محلي | service+HTTP | PASS | `/tmp/commerce-tests.log` منسوخ أدناه | رحلة جهاز منشور |
| C10 | اختبارات Flutter فاشلة | إصلاح مسار الإعلان/الموعد وتوقعات الوسائط | `flutter test test/features/marketplace` | 164 PASS | log أدناه | رحلة جهاز |

## قرارات ما زالت مفتوحة

- عتبات/سياسة عدّ المشاهدات (غير معتمدة).
- تخزين الوسائط الدائم (مؤجل سابقًا).
- جداول رسوم توصيل متعددة المدن (غير معتمدة من المالك).

## ما لم يُشغَّل بعد على النسخة المنشورة

- رحلة شراء COD كاملة على Render بحسابات اختبار.
- رحلة حجز من بوابة الجهة → تطبيق → قبول.
- Universal Links / App Links لفتح المشاركة والتطبيق مغلق.
