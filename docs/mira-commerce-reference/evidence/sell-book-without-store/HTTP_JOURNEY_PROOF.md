# HTTP journey proof

| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |
|---|---|---|---|---|
| حسابات اختبار بلا storeUrl | seed | ثبت من الخادم فقط | seller.storeUrl=null salon.storeUrl=null | Prisma seed — تجهيز اختبار |
| تجهيز منتج بمقاسين ومخزون (seed) | seed→seller product | ثبت من الخادم فقط | S stock=1 M stock=3 mode=internal_cod | productId=edef6af3-cd13-4a33-a90b-ac4ad0f5cbbb — تجهيز اختبار وليس محرر شريك حي |
| شراء COD مقاس S عبر HTTP تجارة | customer+seller+admin | ثبت من الخادم فقط | ref=MO-261114-5EPEJ2 cust=200 seller=200 admin=200 salonGet=404 salonListHas=false S.reserved=1 M.reserved=0 M.stock=3 | orderId=798eb8ee-27b5-4d2d-8a06-4562be0ba239 HTTP Nest commerce — ليس تطبيق الجوال |
| قبول→تجهيز→تسليم→تحصيل من بوابة البائع (HTTP) | seller partner API | ثبت من الخادم فقط | collect=201 payment=collected S.stock=0 S.reserved=0 | partners/me/commerce — ليس متصفح البوابة |
| طلب موعد قبل القبول (HTTP) | customer | ثبت من الخادم فقط | ref=MB-261114-P5K68Z status=requested payMode=pay_at_venue | قبل قبول الشريك — الحالة requested |
| قبول الشريك وظهور التأكيد للعميلة والإدارة | salon+customer+admin | ثبت من الخادم فقط | accept=confirmed customer=confirmed admin=200 sellerGet=404 | bookingId=f972ba27-6c8d-45de-8f2d-02b961600dad |
| حجز ثانٍ ثم إلغاء — عودة الموعد | customer | ثبت من الخادم فقط | cancel=cancelled slot720.available=true | day=2026-11-20 |
| محرر: عرض فقط → القيمة المحفوظة | editor-path coerce | ثبت من الخادم فقط | input=display saved=external (ليس display؛ يساوي رابط خارجي external) | editor-drafts.service.ts coerce — محرر المتصفح لم يُفتح |
| تفعيل عرض الشريك بمقطعين + عرض مستقل | product row | ثبت من الخادم فقط | activated=internal_cod mediaIds unchanged=3b52ced5-4af8-48eb-8594-123969558075,c60779bd-e480-4c92-a0c5-ba84d5f084af independent=external | تفعيل المنتج يؤثر على مقاطعه؛ المستقل يبقى external |
| إسناد عرض الإدارة لصاحبه من الواجهة | admin UI | فشل | publisher=39e7ed5b-06bf-44ef-a19b-53a33281ef3c advertiser=39e7ed5b-06bf-44ef-a19b-53a33281ef3c product.partner_id=39e7ed5b-06bf-44ef-a19b-53a33281ef3c — لا مسار claim؛ تعديل partner_id اليدوي مرفوض كدليل | STOP: missing ownership-claim journey |
| سباق آخر قطعة مقاس S | two customers HTTP | ثبت من الخادم فقط | wins=1 lostStatus=409 lostCode=OUT_OF_STOCK | آخر وحدة size-s |
| سباق نفس الموعد (طلب معلّق) | two customers HTTP | ثبت من الخادم فقط | wins=1 codes=BOOKING_SLOT_FULL,requested | capacity=1 يمنع طلبين متعارضين أصلًا قبل التأكيد |
| ضغط تأكيد مرتين بنفس المفتاح | customer HTTP | ثبت من الخادم فقط | sameId=true statuses=201,201 codes=undefined,undefined detail={"order":{"id":"5dd59a18-9145-4f9b-a483-292a7993d7da","publicNumber":"MO-261114-R7WVHT","partner":{"id":"e54bff6c-9aac-4632-b3f5-5babea94b90d","nameAr":"بائع HTTP بلا متجر"},"fulfi | publicNumber=MO-261114-R7WVHT |
| تطبيق العميلة من فيديو Discover | Flutter iOS | لم يُختبر | الافتراضي يشير لإنتاج mira-api-n4p3؛ تشغيل الشراء على الهاتف يلمس/يقرأ إنتاجًا — مرفوض في هذا التكليف | MiraApiConfig.baseUrl default = production |
| متصفح بوابة الشركاء (UI) | partners portal browser | لم يُختبر | لم تُفتح جلسة متصفح؛ الانتقالات نُفذت عبر HTTP API للبوابة | limit: no portal browser session |
