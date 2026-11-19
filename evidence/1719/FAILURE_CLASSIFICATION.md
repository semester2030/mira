# 1719 — إصلاح إلغاء الانتظار الحقيقي

| مشكلة 1718 | السبب | إصلاح 1719 |
|---|---|---|
| اختبار abort يعتمد على `debugForceProxyClientGone` | `HttpResponse.done` صامت قبل أي كتابة | `detachSocket` + `listen(onDone)` أثناء الانتظار |
| خدمة بعد الانتظار تُغلق بلا ترويسة | تسليح `response.done` قبل detach يُكمل المستقبل فورًا → false abort | لا تُسلَّح `response.done` إلا في المسار غير المنفصل |
| finalize أثناء الانتظار | مسار `.part` القديم بعد rename | إعادة `_openBodyFile` قبل البث |
