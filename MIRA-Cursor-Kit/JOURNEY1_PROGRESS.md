# رحلة ١ — تقدّم التنفيذ (فرع `mira/catalog-provider-rc1`)

## مكتمل في الكود

1. **جرد:** `INVENTORY.md`
2. **دليل ٧٤ خدمة:** `mira-api/src/marketplace/taxonomy/catalog-guide.v1.json` + `GET /marketplace/catalog-guide`
3. **S042/S043:** أوراق `beauty.face_care.cleanse/hydrate` + قوالب `face_care_cleanse/hydrate`؛ حظر أسنان/ليزر للتسجيل الجديد
4. **عبارات البوابة:** دمج عبارات الدليل في `descriptionPhrases` + احتياطي من `ServiceTemplates`
5. **اسألي ميرا ↔ العرض:**
   - Flutter: زر في `ServiceDetailScreen` → `marketplaceOfferId`
   - API: حقن حقائق الوصف/السعر/المدة عند إنشاء الجلسة
   - رد محلي لـ «وش تشمل الجلسة؟» من وصف المقدّم فقط
6. **دليل المطوّر:** `docs/CATALOG_GUIDE_DEVELOPER.md`
7. **فصل إعلاني/خدماتي (صالون/عيادة):** قائمة «إعلاني الرئيسي» منفصلة عن «خدماتي»

## اختبارات آلية نجحت

- `catalog-guide.schema-tests.ts` — ٢٢ مقدّم / ٧٤ خدمة / journey1
- `marketplace-offer-grounding.schema-tests.ts` — الرد من الوصف المعدّل
- `consultation-degraded-reply.schema-tests.ts` — يشمل مسار العرض

## متبقٍ لإثبات الرحلة المتصلة (بوابة → جوال)

- تشغيل API + بوابة على نفس قاعدة محلية
- مقدّم BC يعدّل وصف S042 من الموقع وينشر
- عميلة ترى الوصف في التفاصيل وتسأل ميرا «وش تشمل الجلسة؟»
- إيقاف الخدمة يمنع الترشيح/الحجز الجديد
- لقطات + تسجيل + ZIP قبول

لا دمج إلى `main` ولا نشر إنتاج في هذه المرحلة.
