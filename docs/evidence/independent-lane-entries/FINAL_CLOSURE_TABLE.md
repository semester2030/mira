# جدول الإغلاق — بوابة الشريك + الرئيسية

| البند | النتيجة | الدليل الجديد | البيئة |
|---|---|---|---|
| مجوهرات من الخادم بلا خطأ ظاهر + فروع rings/necklaces/bracelets/earrings | **PASS** | `jewelry-real-connection.json` · `portal_jewelry_real_server.png` | محلي proxy → API إنتاج |
| سلبي: fallback/خطأ يُسقط بوابة الاتصال الحقيقي | **PASS** | `jewelry-real-connection-negative.json` | محلي |
| دخان المداخل المستقلة | **PASS** | `portal-lane-smoke.json` | محلي labeled |
| 5 عروض حفظ→تطبيق→شراء/حجز بمعرّفات | **BLOCKED** | لا اعتماد شريك في البيئة | يلزم `MIRA_PARTNER_EMAIL` + `PASSWORD` |
| الرئيسية 320/390/430 | **PASS محلي** | `NEW_full_home_{320,390,430}.png` | Flutter harness |
| فيديو امتلاء/تفريغ + ضغط | **PASS محلي** | `MOTION_logo_fill_press.mp4` | Flutter |
| commit | `8f8168b` (إصلاح API فوق `0799bcb`) | git | `mira/elegance-e1-taxonomy-foundation` + `main` |
| بوابة Render | **LIVE** `dep-dbpv8bgae00c73fj220g` @ `0799bcb` ثم دفع `8f8168b` | https://mira-partners-portal.onrender.com | Fayez workspace |
| API Render | أول بناء فشل (`draftAttributesSet`)؛ إصلاح `8f8168b` دُفع — تحقق الحالة أدناه | https://mira-api-n4p3.onrender.com | Fayez workspace |
| آيفون Release | **FAILED** | `No space left on device` أثناء Xcode؛ الجهاز لاسلكي فقط | تثبيت كابل + تفريغ ≥10Gi |
| متجر / TestFlight | **NOT DONE** | منفصل عن تثبيت الكابل | — |

**لا إغلاق نهائي** — شروط البرومت: بوابة منشورة مختبرة + تطبيق على الآيفون لم يكتمل كلاهما معًا بعد. العروض الخمسة غير مثبتة.
