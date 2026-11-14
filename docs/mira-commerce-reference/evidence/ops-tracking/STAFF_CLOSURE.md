# Staff + booking detail closure

| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |
|---|---|---|---|---|
| عزل رقم الحجز: المالكة 200 · عميلة أخرى 404 | customer API | ثبت من الخادم فقط | A=200 B=404 ref=MB-261114-UT3A4C | MB-261114-UT3A4C |
| دعم يقرأ الطلب ويُرفض تعديله (403 ADMIN_READ_ONLY) | ops.support API | ثبت من الخادم فقط | get=200 mutate=403 actor=ops.support | MO-261114-D46ESU |
| سر الدعم يثبت الهوية ولا يُزوَّر عبر X-Admin-Actor | guard | ثبت من الخادم فقط | actor=ops.support role=support | session |
| دعم يرى «يحتاج تدخل» لنفس الطلب المتأخر | ops.support API | ثبت من الخادم فقط | hit=true | attention |
| واجهة الدعم: تفتح الطلب ولا تعرض أزرار التعديل/التحصيل | support UI | ثبت من الواجهة | sees=true collectBtn=false | staff/02_support_order_readonly.png |
| مشرف موثّق يقبل نفس طلب ميرا ويظهر اسمه وسببه في السجل | ops.sara UI+API | ثبت من الواجهة | status=accepted actor=ops.sara note=قبول مشرف موثّق على طلب ميرا display=موظف إدارة (ops.sara) | staff/04_supervisor_after_accept_same_order.png |
| بعد قبول المشرف يختفي تنبيه مهلة القبول لنفس الرقم | attention API | ثبت من الخادم فقط | still=false | MO-261114-D46ESU |
| الإدارة تفتح تفاصيل الحجز بالرقم مع المقدّم والخطوة والتسلسل | supervisor UI | ثبت من الواجهة | ref=MB-261114-UT3A4C ok=true | staff/05_booking_detail.png |
| شريك آخر يبحث برقم حجز ميرا ولا يراه | other partner UI | ثبت من الواجهة | sees=false | staff/06_other_partner_booking_search.png |
| Flutter من فيديو → نسخ الرقم | iOS | لم يُختبر | ما زال مانع OTP/Firebase على المحاكي؛ الكود جاهز للنسخ والخطوة التالية | order_detail_screen |
