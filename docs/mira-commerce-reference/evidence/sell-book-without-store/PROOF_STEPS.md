# SBWS proof run

| الخطوة | المنفّذ | الطبقة | ما حدث فعليًا | النتيجة | الدليل |
|---|---|---|---|---|---|
| إنشاء حسابات معزولة بلا storeUrl | harness | server | seller.storeUrl=null salon.storeUrl=null canCreateProduct=true canCreateService=true | PASS | partners edd5d3e7-d17f-4f7c-b3f9-83dd58cf62c8 / 7ebf1c9f-333a-4f9a-99e4-411a77538ae0 |
| طلب COD: رؤية العميلة والبائع والإدارة؛ الصالون لا يرى | customer/seller/admin/salon | server | publicNumber=MO-261114-BW24ME cust=MO-261114-BW24ME seller=MO-261114-BW24ME admin=MO-261114-BW24ME salonSees=false | PASS | orderId=c120864b-af24-488e-8972-ca5e77b9bb49 |
| تسليم + تسجيل تحصيل COD | seller | server | fulfillment=delivered payment=collected stockQty=1 reserved=0 customerPayment=collected | PASS | collectionActor=partner:sbwsmwfoq6ag-seller-pu |
| طلب موعد قبل القبول | customer/salon/seller | server | cust=requested salon=requested sellerSees=false payMode=pay_at_venue | PASS | bookingId=e2b60290-fa6d-4ffa-b263-b769709ffbd4 publicNumber=MB-261114-GFC5Q2 |
| قبول مقدّم الخدمة | salon | server | salon=confirmed customer=confirmed | PASS | events=2 |
| إلغاء العميلة يحرّر الموعد | customer | server | status=cancelled slotAvailable=true remaining=1 | PASS | day=2026-11-19 |
| محرر: اختيار «عرض فقط» / display | editor-path | editor-path | input=display → stored=external; input=not_for_sale → stored=external; DB after write=external | PASS | editor-drafts.service.ts coerce: only internal_cod/external persist; else external |
| تفعيل عرض يملكه الشريك مع مقطعين | seller-owned product | server | productId=fc94c69f-e63a-4947-b41f-d3cce7eab71d mode=internal_cod mediaIds=4c761c6a-cccc-415d-8f44-4888cec9508a,f93930e0-9859-44b7-a8e4-b7bb1842e240 idsUnchanged=true | PASS | commerce owns purchaseMode on Product; CatalogMedia.ownerId=product |
| عرض منشور من الإدارة → إسناده لصاحبه من الواجهة | admin→owner claim | server | شراء المنتج الإداري الخارجي مرفوض: EXTERNAL_PRODUCT_NOT_PURCHASABLE؛ الملكية تبقى partner_id=511f919d-0bb9-440e-b631-0a187f8e9005 (ميرا) لا البائع edd5d3e7-d17f-4f7c-b3f9-83dd58cf62c8 | PASS | adminProduct=5e72e486-5f05-4f55-9a9c-42c8b3e1c403 ad=60926680-d5e0-4a32-8901-bf886cfeab1d invitePathExists=false |
| هل تستطيع الإدارة تفعيل عرض قديم لصاحبه الصحيح من الواجهة؟ | admin UI | ui-not-run | غير مثبت — لا API دعوة/claim في النطاق المفحوص؛ تعديل DB مباشر لا يُعد إثبات رحلة مستخدم | FAIL/STOP | STOP: missing ownership-claim journey |
| سباق آخر قطعة من عميلتين | two customers | server | wins=1 reserved=1 lostCode=OUT_OF_STOCK | PASS | product=cbe7c9fd-02f9-4d5c-b178-cefc5a37cfba |
| سباق نفس الموعد من عميلتين | two customers | server | wins=1 activeRows=1 | PASS | slot=2026-11-19T08:00:00.000Z |
| ضغط مرتين على تأكيد الطلب (نفس المفتاح) | customer | server | id1=f77ebf62-a125-4411-beb8-336aaca832c8 id2=f77ebf62-a125-4411-beb8-336aaca832c8 same=true replays=1 | PASS | publicNumber=MO-261114-DMYFYG |

## الإجابات الثلاث
- أول بيع اكتمل؟ **نعم (خادم/خدمة)**
- أول حجز اكتمل؟ **نعم (طلب→قبول على الخادم)**
- الإدارة تفعّل عرضًا قديمًا لصاحبه من الواجهة؟ **لا — غير مثبت**
