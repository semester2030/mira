# MIRA seller closure

| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |
|---|---|---|---|---|
| تمثيل حساب ميرا كبائع (developer) بلا storeUrl | seed | ثبت من الخادم فقط | partnerId=98175826-524a-4aa4-bfa5-0f6d62b90b51 type=developer nameAr=ميرا storeUrl=null email=mira-seller-sbmiramwfq7ypq@test.local | نفس علاقة type=developer المعتمدة لصلاحية البيع+الخدمة |
| دخول بوابة الشريك بصفة ميرا البائع (نموذج الدخول) | mira seller UI | ثبت من الواجهة | name=ميرا url=http://127.0.0.1:18775/dashboard.html?api-base=http%3A%2F%2F127.0.0.1%3A49686%2Fapi%2Fv1 | mira-seller/01_mira_seller_dashboard.png |
| تفعيل شراء العرض القديم من المحرر الحقيقي (فتح في النموذج → تفعيل COD → نشر الآن) | mira editor UI | ثبت من الواجهة | mode=internal_cod mediaUnchanged=true indep=external editorUiOk=true | mira-seller/02*.png + BEFORE/AFTER_IDS — التفعيل على صف المنتج؛ المستقل عرض فقط |
| طلب من عرض ميرا القديم — المستلم partner_id = ميرا | customer API (Flutter Discover لم يُغلق بعد) | ثبت من الخادم فقط | ref=MO-261114-8LEDWL partner=98175826-524a-4aa4-bfa5-0f6d62b90b51 nameAr=ميرا | orderId=539c1505-d779-4d75-ade2-343f250e740d |
| ميرا البائع يرى الطلب في البوابة | mira seller UI | ثبت من الواجهة | sees MO-261114-8LEDWL=true | mira-seller/03_mira_orders_new.png |
| ضغط أزرار القبول→التجهيز→التوصيل→التسليم→التحصيل | mira seller UI buttons | ثبت من الواجهة | fulfillment=delivered payment=collected S=1 M=3 | mira-seller/04–08_*.png — لا page.evaluate للانتقالات |
| طلب موعد على خدمة ميرا — status=requested | customer API | ثبت من الخادم فقط | ref=MB-261114-TNVZQC partner=98175826-524a-4aa4-bfa5-0f6d62b90b51 | bookingId=f0f296ea-e3d2-4dbf-bdda-6282b67b5169 |
| تأكيد ثم إتمام نفس الحجز من أزرار البوابة | mira provider UI buttons | ثبت من الواجهة | status=completed (ساعة اختبار: تحريك startsAt للماضي بعد التأكيد لنفس MB-261114-TNVZQC) | mira-seller/09–11_*.png |
| إلغاء حجز ثانٍ وتحرير الموعد | customer API | ثبت من الخادم فقط | cancel=cancelled slotFree=true | second=MB-261114-ECTB4T |
| الإدارة: دخول من شاشة المفتاح ثم تفاصيل الطلب والحجز | admin UI | ثبت من الواجهة | shellOpen=true order=true miraSellerVisible=true booking=true refs=MO-261114-8LEDWL/MB-261114-TNVZQC | mira-seller/12–15_*.png |
| Flutter Discover من فيديو → سلة → طلباتي | iOS MiraRC2 | لم يُختبر | مانع: شاشة دخول العميلة (OTP/Firebase). MiraRC2 أقلع؛ هوك MIRA_USE_AUTH_EMULATOR جاهز؛ لم تُكمَل الجلسة من الشاشة إلى السلة | شاشة الدخول — لا لقطة طلب من الجوال |
