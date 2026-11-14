# متابعة العمليات — إثبات

| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |
|---|---|---|---|---|
| إنشاء طلب MO + ثبات الرقم عند إعادة التأكيد | customer A API | ثبت من الخادم فقط | ref=MO-261114-8KULVA replaySame=true | MO-261114-8KULVA |
| العميلة أ تفتح برقمها العام؛ العميلة ب لا ترى نفس الرقم | customer scope | ثبت من الخادم فقط | A=200 B=404 | MO-261114-8KULVA |
| إنشاء حجز MB على مقدّم ميرا | customer A API | ثبت من الخادم فقط | ref=MB-261114-Y7HMMF partner=ميرا | MB-261114-Y7HMMF |
| يحتاج تدخل: طلب تجاوز مهلة القبول | admin API | ثبت من الخادم فقط | hit=true count=3 | attention before accept |
| ميرا البائع تبحث برقم طلبها وتراه؛ لا ترى طلب الشريك الآخر | mira partner UI | ثبت من الواجهة | own=true foreign=false | ui/01_mira_search_order.png |
| شريك غير مالك يبحث برقم طلب ميرا ولا يراه | other partner UI | ثبت من الواجهة | seesForeign=false | ui/02_other_search_mira_order.png |
| بعد القبول يزول تنبيه مهلة القبول لنفس الرقم | admin API after UI accept | ثبت من الخادم فقط | stillStale=false | MO-261114-8KULVA |
| إجراء إداري يُسند لموظف عبر X-Admin-Actor وليس المفتاح وحده | admin API | ثبت من الخادم فقط | actorId=ops.sara display=موظف إدارة (ops.sara) | MO-261114-MP53LJ |
| الإدارة: دخول بموظف مسمّى + بحث بالرقم + تفاصيل مع الخطوة التالية | admin UI | ثبت من الواجهة | sees=true next=true staff=ops.sara | ui/04–06_*.png |
| الإدارة تفتح/تجد الحجز بنفس الرقم MB | admin UI | ثبت من الواجهة | booking=MB-261114-Y7HMMF sees=true | ui/07_admin_booking_search.png |
| تفاصيل العميلة تتضمن nextActionAr والرقم العام | customer API | ثبت من الخادم فقط | next=المتجر قبل الطلب ويجهّزه ref=MO-261114-8KULVA | order DTO |
| Flutter Discover → طلباتي مع نسخ الرقم | iOS MiraRC2 | لم يُختبر | أُضيف نسخ الرقم والخطوة التالية في شاشات الطلب/الحجز؛ مسار OTP على المحاكي لم يُغلق في هذا التشغيل | order_detail_screen / bookings_list_screen |
