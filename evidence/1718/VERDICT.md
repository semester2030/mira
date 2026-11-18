# حزمة 1718 — عزل attach القديم + خروج انتظار الـproxy

## مثبت بالاختبارات

| بند | نتيجة |
|---|---|
| حراسة بعد cut/warm/openResolved/مهلة init | المسار البالي لا يستبدل B |
| `_dropIfStale` لا يتخلّص من parked/warm/prepared | left_dark + release بلا double-dispose |
| unmute بالٍ على نفس الـcontroller (A→صورة→A) | لا يُكتم المعاد استخدامه |
| cut بتوليد A بعد ملكية B | no-op |
| انتظار proxy عند abort | يخرج عبر `debugForceProxyClientGone` (dart:io لا يُظهر peer-close بلا كتابة) |
| بث الجسم بعد abort | `flush().timeout` → خروج الحلقة |
| Focus مشغّل+كاش | **75 نجحت** |
| مجموعة discover_* | **156 نجاح / 8 إخفاقات** معلنة (توجيه/إعلانات/شراء — خارج الكاش/المشغّل) |

## الجهاز

مثبّت ومُشغَّل **2026111718** على هاتف فيّز (`databaseUUID` نفسه — بلا مسح).  
ZIP: `/Users/fayez/Desktop/mira-discover-1718-2026111718.zip`  
SHA256: `79a7dc68e758be5a873d85faebc48f259c529d357663c85d5fc5c3122eb1ade5`  
الأداء مفتوح حتى سجل+شاشة لهذه النسخة فقط.

## مفتوح مستقل

تنظيم الملفات · 3 فيديوهات + 10 صور · إثبات أداء على الجهاز.
