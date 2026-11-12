# جمالك — مساران + في موقعك — جدول القبول

**Base:** `98f9691` + local dual-registration changes (uncommitted at package time)  
**تاريخ الحزمة:** 2026-11-12

قاعدة المنتج: **من يقدّم الخدمة = اسم الحساب وصاحب الحجز**؛ **أين تُقدَّم = لكل خدمة**. فلتر «في موقعك» مكان فقط — لا يحوّل النوع إلى صالون ولا يستبعد المستقلات.

| الحالة | المتوقع | النتيجة الفعلية | الدليل |
|--------|---------|-----------------|--------|
| تسجيل نورة «أسجّل باسمي» بلا سجل/فرع | طلب join بهوية `independent` فقط، بلا `crNumber`، بلا `PartnerBranch` عند الاعتماد | **PASS (schema + apply UI + server rules)** | `apply.html` مسار مستقل؛ `INDEPENDENT_NO_COMMERCIAL_REGISTER`؛ approve لا ينشئ فرعًا؛ OTP جوال مطلوب |
| توثيق جوال ≠ ترخيص / إخفاء عام | OTP يوثّق الجوال؛ الكتالوج لا يعرض الهاتف افتراضيًا | **PASS (server)** | `publicContactVisible: false`؛ `publicContactPhone()` يرجع null |
| فصل الملف عن تفعيل الحجز | قبل اعتماد الأنشطة لا حجز؛ بعده `bookingActivated` | **PASS (server)** | `activitiesMeta.bookingActivated` عند decide؛ `publicBookingEnabled` |
| صالون لمسة: نفس الخدمة فرع + موقع عميلة | `placeMode=either` يظهر تحت home و branch | **PASS (schema)** | `dual-registration.schema-tests.ts`؛ `placeModeMatchesFilter('either',…)` |
| بحث «مكياج عروس ← في موقعي» | نورة (home) + الصالون (either) بهويتين | **PASS (schema filter)** | matchCatalogItem noura+lamsa تحت `placeModes:['home']` |
| فلتر «في المقر» | يبقى الصالون؛ تختفي نورة إن كانت متنقلة فقط | **PASS (schema)** | noura `placeMode=home` → null تحت branch |
| عيادة فيديو تعريفي vs خدمة | `videoScope=provider_intro\|service_specific`؛ الطبية خارج «في موقعك» | **PASS (portal+API+schema)** | محرر وسائط؛ detail يعيد videoScope؛ laser تحت home = null |
| صبغة/استشوار offerId صحيح لكل دائرة | ربط الورقة السابق | **PASS (local binding prior)** / **prod portal→app NOT_VERIFIED** | `beauty-color-binding` + حزمة `98f9691`؛ إغلاق إنتاج كامل لم يُعَد في هذه الجولة |
| رحلة بوابة شريك → Flutter فعلي (نورة/لمسة/عيادة) | تسجيل ونشر وحجز من الجوال | **NOT_VERIFIED** | لم تُنفَّذ رحلة موقع→جوال كاملة في هذه الحزمة (لا لقطات تسجيل/حجز حيّة) |
| منع حجز الموظفة مرتين (تقويم واحد + resourceId) | تضارب سعة المورد | **PARTIAL** | التقويم الموحّد + `resourceId` موجودان سابقًا؛ لم يُثبت سيناريو موظفة صالون على جهاز |

## اختبارات آلية نُفِّذت

```
npx tsx src/partners-portal/partner-activities/partner-activities.schema-tests.ts
npx tsx src/partners-portal/partner-activities/dual-registration.schema-tests.ts
npm run test:beauty-a
```

## ملفات رئيسية

- `partners-portal/web/apply.html` — مساران
- `mira-api/.../partner-activities.*` — providerKind + تعارض الهويات
- `mira-api/.../catalog-filters.ts` — either + في موقعك طبي
- `mira-api/.../beauty-taxonomy.v1.json` — تسمية «في موقعك»
- `partners-portal/web/js/catalog-journey.js` — مكان لكل خدمة + فيديو
- Flutter discover/service detail — تسميات + intro video picker
