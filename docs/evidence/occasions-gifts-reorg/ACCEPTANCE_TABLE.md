# مناسباتك + الهدايا — جدول الإغلاق

- **نسخة العمل (محلي / غير منشور):** worktree `elegance-e1` @ branch `mira/elegance-e1-taxonomy-foundation` فوق `b27557c` + تغييرات occasions/gifts غير مُودَعة بعد.
- **بيئة الاختبار المنفَّذة:** محلي — `npx tsx mira-api/src/marketplace/taxonomy/occasions-gifts-reorg.schema-tests.ts` → `ok`.
- **إنتاج Render API:** `https://mira-api-n4p3.onrender.com` ما زال `occasions.definitionsVersion=2` (12 عقدة) — **بدون** `occasions.hospitality` / `packages` / `type.milka` / `type.engagement`.
- **حكم الإغلاق:** **غير مغلق** — الرحلات الخمس على نفس نسخة الخادم الحيّة لم تُنفَّذ؛ النجاح المحلي ≠ نجاح الإنتاج.

| الرحلة | النتيجة المتوقعة | النتيجة الفعلية | الدليل |
|---|---|---|---|
| مقدمة صبّابات معتمدة تطلب إضافة بوفيه؛ البوفيه ممنوع قبل الموافقة ويُتاح بعدها؛ الصبّابات تبقى | منح `occasions.hospitality` لا يفتح `occasions.buffet`؛ رفض الخادم `ACTIVITY_NOT_APPROVED` عند تصنيف/نشر بوفيه؛ بعد قبول الفرع يُتاح | **غير منفَّذة على الخادم المشترك** (التصنيف الجديد غير منشور؛ يحتاج حساب شريك + موافقة إدارة) | كود: `assertAuthorizedWrite` في `editor-drafts` + `partners-portal.service`؛ كتالوج الأنشطة من أوراق التصنيف |
| عميلة: صبّابتان لمِلكة + مدينة + تاريخ | تظهر خدمة `occasions.hospitality` ذات `hostessCount≥2` و`occasionTypeIds` يشمل milka ومتاحة في المدينة/التاريخ؛ تُستبعد غير المطابقة | **مُثبتة محليًا (فلاتر نقية)**؛ **غير منفَّذة على الإنتاج** | `occasions-gifts-reorg.schema-tests.ts` — hospitality filter؛ إنتاج v2 لا يملك الورقة |
| عميلة: باقة تخرج منزلية لـ٤٠ ضيفة | تظهر باقة `occasions.packages` بسعرها و`packageIncludes`؛ لا تُعرض المكوّنات كخدمات مستقلة ما لم تُنشر مستقلة | **مُثبتة محليًا (فلاتر نقية + guestsCount=40)**؛ **غير منفَّذة على الإنتاج** | نفس ملف الاختبار — package hit فقط |
| عميلة: ورد وشوكولاتة لاستقبال مولود + توصيل اليوم | هدية منتج متوفرة و`sameDayDelivery`؛ زر سلة لا حجز | **مُثبتة محليًا (فلاتر نقية)**؛ **غير منفَّذة على الإنتاج** | نفس الاختبار — gifts.flowers + sameDayDelivery |
| تغيير التصنيف لفرع غير معتمد يُرفض من الخادم دون تغيير السجل؛ العروض/الفلاتر القديمة تعمل | `ACTIVITY_NOT_APPROVED` عند put/materialize بفرع غير ممنوح؛ `occasions.decor` يبقى منتج ضيافة للبيع | **جزئي محلي:** decor=`product` في taxonomy v3؛ رفض التصنيف يحتاج رحلة شريك على خادم منشور | taxonomy JSON + schema test؛ إنتاج لم يُحدَّث |

## ما أُنجز في الشجرة المحلية
- taxonomy occasions v3 / gifts v2 + phrases v2 + orbs فريدة لكل فرع
- قيد الكتابة من الخادم على مسودة المحرر + التحويل
- حقول فرع (hostessCount / buffet / packageIncludes / sameDayDelivery) بـ dependsOn
- عبارات وصف في المحرر الأفقي مع استعادة الاختيارات
- فلاتر كتالوج: ورقة الخدمة عبر `attributes.subcategory`، hostessCountMin، guestsCount، sameDayDelivery
