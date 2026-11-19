# نشر الإنتاج والجهاز

## مراجع قبل / بعد

| جزء | قبل | بعد (Render live) | دليل |
|-----|-----|-------------------|------|
| mira-api | `6dff5b7` · dep-dbtvohe7bikc739eorq0 | **`0455bbc`** · dep-dbvh4cp7lnhs739j6hd0 **live** | Render get_deploy status=live |
| partners-portal | `a07f64f` | **`0455bbc`** · dep-dbvh4cp7lnhs739j6iag **live** | ads.js SHA يطابق origin/main |
| admin-portal | `e0fc96f` | **`e0fc96f` (لم يتغير — لا Diff في admin-portal/web)** | list_deploys |
| DB | بلا commerce_visits على الإنتاج سابقًا | ترحيل `20261119123000_commerce_visits_rc4` عبر `prisma migrate deploy` عند إقلاع الخدمة | نجاح start = live |
| iOS على جوال فايز | غير مثبت لهذا الرقم | **مثبّت** `1.0.0+202611191900` · `app.mira.beauty` | raw/ios_install_attempt.txt |

خادم التطبيق: `https://mira-api-n4p3.onrender.com/api/v1`  
بوابة المركز: `https://mira-partners-portal.onrender.com`  
PR: https://github.com/semester2030/mira/pull/14

## خطوات اختبار فايز على الجوال

1. افتح ميرا → تأكد أن البناء `202611191900`.
2. **اكتشفي:** شغّل فيديو؛ افتح تفاصيل منتج وخدمة.
3. **حجز خدمتين:** من مركز منشور احجز خدمتين في زيارة واحدة؛ انسخ رقم الزيارة؛ طابقه في بوابة المركز.
4. **اسألي ميرا:** من الرئيسية → ترحيب/شرائح؛ بعد رد ناجح راقب الشرائح السياقية؛ داخل خدمة اسأل «بكم البديل؟».
5. من البوابة: أغلق حجز خدمة ثم اسحب نشرها؛ أعد السؤال وتحقق: مغلق=تفاصيل فقط، مسحوب=يختفي.

## ما لم يُغلق في هذه الجولة

- إثبات جهاز لشرائح ما بعد الرد الناجح (الأسئلة السياقية).
- إثبات جهاز لفيديو اكتشفي / تفاصيل منتج في هذه الجلسة.
