# UI browser proof

| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |
|---|---|---|---|---|
| تجهيز حسابات ومحتوى (seed) | harness | ثبت من الخادم فقط | storeUrl null; product=7a2b3175-a0cb-4748-ba88-504e5fc721ba; independent=509ef26b-1310-4d7a-aa9f-d37e7aab2f17; adminOffer.owner=4ba27708-5a9b-4624-8c40-c3e967a1468d | Prisma seed |
| التحقق من وجهة API قبل التجربة | harness | ثبت من الخادم فقط | apiBase=http://127.0.0.1:65296/api/v1 me=200 name=بائع واجهة بلا متجر storeUrl=null | GET /partners-portal/me |
| إنشاء طلب COD عبر API (بدل فيديو الجوال) | customer API AUTH_SKIP | ثبت من الخادم فقط | ref=MO-261114-Y9BP7T | orderId=11b7c0e4-091b-4871-b37b-2fbabf15c9e2 |
| إنشاء طلب موعد عبر API — حالة بانتظار الموافقة | customer API | ثبت من الخادم فقط | ref=MB-261114-P8KXY2 status=requested | bookingId=cf8b4812-05c7-4743-a92a-c27ad74ce94d |
| بوابة البائع تعرض الطلب | seller browser | ثبت من الواجهة | name=بائع واجهة بلا متجر sees MO-261114-Y9BP7T=true | ui/02_seller_orders.png |
| قبول→تجهيز→تسليم→تحصيل من جلسة بوابة البائع | seller browser | ثبت من الواجهة | accepted→preparing→out_for_delivery→delivered→collected | ui/04_seller_collected.png — PartnersApi داخل صفحة البوابة |
| محرر البوابة: عرض فقط / تفعيل شراء | seller browser editor | ثبت من الواجهة | errors=none DB indep=external product=internal_cod | ui/11_seller_editor_after.png — لا قيمة display منفصلة؛ external = بلا شراء داخلي |
| مقدّم الخدمة لا يرى طلب البائع | salon browser | ثبت من الواجهة | apiList=[] seesOrder=false | ui/05_salon_no_order.png |
| قبول الحجز وإتمام حجز بعد وقت البدء من بوابة الصالون | salon browser | ثبت من الواجهة | listHad=true confirm=confirmed complete=completed | ui/07_salon_confirmed.png |
| البائع لا يرى حجز الصالون | seller browser | ثبت من الواجهة | apiList=[] has=false | ui/08_seller_no_booking.png + PartnersApi.commerceBookings |
| إسناد عرض ميرا لصاحبه من الواجهة | admin/partner UI | فشل | adminOffer.partner_id=4ba27708-5a9b-4624-8c40-c3e967a1468d; لا عنصر دعوة/claim في لوحة الشريك | STOP — no claim UI; DB partner_id edit not used |
| لوحة الإدارة تعرض الطلب والحجز | admin browser | ثبت من الواجهة | order=true booking=true err=none | ui/09_admin_orders.png + ui/10_admin_bookings.png |
| المخزون بعد التحصيل | DB | ثبت من الخادم فقط | S=1/0 M=4/0 | variant inventory |
| Flutter Discover من فيديو حتى السلة | iOS | لم يُختبر | مانع: التطبيق يتطلب Firebase؛ لا AUTH تجريبي على العميل. الطلب أُنشئ عبر API ثم أُكمل على بوابات المتصفح. | blocker client auth |
