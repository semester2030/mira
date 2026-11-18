# حزمة 1719 — إلغاء انتظار الـproxy الحقيقي (بلا خطاف)

## مثبت بالاختبارات

| بند | نتيجة |
|---|---|
| إلغاء انتظار Range عند `HttpClient.close(force)` | يخرج الانتظار عبر `detachSocket` + `listen(onDone)` **بلا** `debugForceProxyClientGone` |
| خدمة Range بعد الانتظار | تُكتب على الـsocket بعد إعادة فتح الملف (finalize آمن) |
| Focus مشغّل+كاش | **75/75** |
| مجموعة discover_* | **158 نجاح / 8 إخفاقات معلنة** — كلها توجيه/إعلانات/شراء/موعد (خارج الكاش/المشغّل) |

## الإخفاقات الثمانية (خارج مسار الفيديو)

- discover routes stay closed unless the test define is on
- product detail treats the store link as an external handoff
- two ads for one original stay distinct and a failed page retries once
- a page that arrives after the query changed is not inserted into the new sequence
- server entry shows loading, then the response, and not an older one
- product chrome shows buy and store without fake success
- preview buy does not open a transaction
- appointment says the operational request is unavailable

## الجهاز

بناء **2026111719**. الأداء مفتوح حتى زوج شاشة+سجل لنفس النسخة أثناء سحب سريع ورجوع.

## مفتوح مستقل

أداء الجهاز · 3 فيديوهات + 10 صور · تنظيم الملفات · إخفاقات التوجيه/الإعلانات أعلاه.
