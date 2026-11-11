# جدول الإغلاق — بوابة الشريك + الرئيسية

| البند | النتيجة | الدليل الجديد | البيئة |
|---|---|---|---|
| مجوهرات من الخادم (source=server) + فروع rings/… بلا خطأ ظاهر | **PASS** | `jewelry-real-connection.json` · `portal_jewelry_real_server.png` | محلي proxy→API إنتاج |
| سلبي: fallback يُسقط بوابة الاتصال الحقيقي | **PASS** | `jewelry-real-connection-negative.json` | محلي |
| دخان المداخل المستقلة | **PASS** | `portal-lane-smoke.json` | محلي labeled |
| 5 عروض حفظ→تطبيق→شراء/حجز | **BLOCKED** | لا بيانات اعتماد شريك في البيئة | يلزم `MIRA_PARTNER_EMAIL/PASSWORD` |
| الرئيسية 320/390/430 | **PASS محلي** | `NEW_full_home_*.png` | Flutter |
| فيديو امتلاء+ضغط | **PASS محلي** | `MOTION_logo_fill_press.mp4` | Flutter |
| commit | `29992dc` | git | elegance-e1 |
| نشر Render | قيد الدفع إلى `main` | mira-api + mira-partners-portal | Fayez workspace |
| آيفون Release | **NOT DONE** | ENOSPC/مساحة القرص | كابل |
| متجر | **NOT DONE** | منفصل | — |

لا إغلاق نهائي قبل نجاح البوابة المنشورة + التطبيق على الآيفون.
