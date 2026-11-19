# جرد التنفيذ — كتالوج ميرا RC1
**فرع:** `mira/catalog-provider-rc1`  
**SHA ابتدائي:** `9dd146e0358806602d7ce03a209aa1300b2c40db`

| المنطقة | الحالة | المسارات | القرار |
|---|---|---|---|
| NestJS API | موجود ونستخدمه | `mira-api/` | وحدات داخل التطبيق القائم |
| Partner كـ مقدّم | موجود ويحتاج تمديدًا | `Partner.type`: brand/clinic/salon/event_planner/developer | ربط BC→salon/clinic؛ لا جدول Provider منفصل |
| دليل الأنواع/الخدمات (٧٤) | أُضيف كمصدر تشغيل | `mira-api/src/marketplace/taxonomy/catalog-guide.v1.json` + `GET /marketplace/catalog-guide` | مصدر واحد للبوابة والتطبيق والمستشارة |
| تصنيف الجمال | موجود ونستخدمه | `beauty-taxonomy.v1.json` → `beauty.face_care.cleanse/hydrate` | مطابقة S042/S043؛ السماح لـ clinic |
| قوالب الخدمة في البوابة | موجود ويحتاج تمديدًا | `partners-portal/web/js/service-templates.js` | قوالب cleanse/hydrate + عبارات الدليل؛ حظر الأسنان/الطبي |
| بوابة المقدّم | موجود ويحتاج تمديدًا | `partners-portal/web/` + `e2b-service-shell.js` | فصل إعلاني/خدماتي + معاينة + عبارات من API |
| اكتشفي / جمالك | موجود ونستخدمه | `lanes.manifest` + Flutter discover | أيقونة العناية → face_care |
| الحجز | موجود ونستخدمه | `CommerceBooking` + `booking_request_screen.dart` | لقطة السعر/الاسم عند التأكيد (تحقق/تمديد) |
| اسألي ميرا | مربوط بالعرض المنشور (RC1) | `marketplaceOfferId` في create-session + `ServiceDetailScreen` + `marketplaceOfferIncludesReply` | «وش تشمل الجلسة؟» من وصف المقدّم |
| مناسبات / مجوهرات عامة | يحتاج تمديدًا | preview lanes | لاحقًا بعد الرحلة الأولى |
| 3 فيديوهات + 10 صور | مفتوح مستقل | قرص الكاش / Discover | لا يُخلط بهذه الدفعة |
| تنظيم ملفات المشغّل | مفتوح مستقل | presentation_video_port | لا يُخلط بهذه الدفعة |

## مطابقة الرحلة الأولى
| دليل الحزمة | الموجود |
|---|---|
| BC مركز عناية | Partner.type `salon` أو `clinic` |
| S042 تنظيف تجميلي سطحي | `beauty.face_care.cleanse` |
| S043 ترطيب وماسك | `beauty.face_care.hydrate` |
