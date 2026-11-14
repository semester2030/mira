# SBWS proof run

| الخطوة | المنفّذ | الطبقة | ما حدث فعليًا | النتيجة | الدليل |
|---|---|---|---|---|---|
| إنشاء حسابات معزولة بلا storeUrl | harness | server | seller.storeUrl=null salon.storeUrl=null canCreateProduct=true canCreateService=true | PASS | partners 49b86ab8-bdb0-4b64-b1e0-9e117cdccd6c / e58e5cbd-ad91-4428-81a3-363b4584f96c |
| طلب COD: رؤية العميلة والبائع والإدارة؛ الصالون لا يرى | customer/seller/admin/salon | server | publicNumber=MO-261114-EM3GK3 cust=MO-261114-EM3GK3 seller=MO-261114-EM3GK3 admin=MO-261114-EM3GK3 salonSees=false | PASS | orderId=a82daa0c-b961-4d45-a780-4a5d081fade0 |
| تسليم + تسجيل تحصيل COD | seller | server | fulfillment=delivered payment=collected stockQty=1 reserved=0 customerPayment=collected | PASS | collectionActor=partner:sbwsmwfoe0nx-seller-pu |
| طلب موعد قبل القبول | customer/salon/seller | server | cust=requested salon=requested sellerSees=false payMode=pay_at_venue | PASS | bookingId=42327255-5137-4da2-a5e4-6ae5746cf57a publicNumber=MB-261114-Z7KPXD |
| قبول مقدّم الخدمة | salon | server | salon=confirmed customer=confirmed | PASS | events=2 |
| إلغاء العميلة يحرّر الموعد | customer | server | status=cancelled slotAvailable=true remaining=1 | PASS | day=2026-11-19 |
| محرر: اختيار «عرض فقط» / display | editor-path | editor-path | input=display → stored=external; input=not_for_sale → stored=external; DB after write=external | PASS | editor-drafts.service.ts coerce: only internal_cod/external persist; else external |
| تفعيل عرض يملكه الشريك مع مقطعين | seller-owned product | server | productId=02e83ec1-f696-4d8e-bced-a9f79a7f6c8c mode=internal_cod mediaIds=6988f240-2a50-4b13-b52f-b647e4875af9,47d3d3a7-acd8-4838-b60f-409af4b807b5 idsUnchanged=true | PASS | commerce owns purchaseMode on Product; CatalogMedia.ownerId=product |
| عرض منشور من الإدارة → إسناده لصاحبه من الواجهة | admin→owner claim | server | شراء المنتج الإداري الخارجي مرفوض: EXTERNAL_PRODUCT_NOT_PURCHASABLE؛ الملكية تبقى partner_id=9403273e-17ca-4ff8-bb66-9ffa59f9f524 (ميرا) لا البائع 49b86ab8-bdb0-4b64-b1e0-9e117cdccd6c | PASS | adminProduct=eff2dfee-531a-406c-ac6b-0af72e7578fe ad=e5d25c3c-9677-4883-bbf7-7dd891bdef60 invitePathExists=false |
| هل تستطيع الإدارة تفعيل عرض قديم لصاحبه الصحيح من الواجهة؟ | admin UI | ui-not-run | غير مثبت — لا API دعوة/claim في النطاق المفحوص؛ تعديل DB مباشر لا يُعد إثبات رحلة مستخدم | FAIL/STOP | STOP: missing ownership-claim journey |
| سباق آخر قطعة من عميلتين | two customers | server | wins=1 reserved=1 lostCode=OUT_OF_STOCK | PASS | product=d5908cb8-41a3-4bc2-90c3-e6e981abe38c |
| سباق نفس الموعد من عميلتين | two customers | server | wins=1 activeRows=1 | PASS | slot=2026-11-19T08:00:00.000Z |
| ضغط مرتين على تأكيد الطلب (نفس المفتاح) | customer | server | id1=119e66b9-557e-404b-b0fe-ff65a7de7fd2 id2=119e66b9-557e-404b-b0fe-ff65a7de7fd2 same=true replays=1 | PASS | publicNumber=MO-261114-CNP4ZG |

## الإجابات الثلاث
- أول بيع اكتمل؟ **نعم (خادم/خدمة)**
- أول حجز اكتمل؟ **نعم (طلب→قبول على الخادم)**
- الإدارة تفعّل عرضًا قديمًا لصاحبه من الواجهة؟ **لا — غير مثبت**
