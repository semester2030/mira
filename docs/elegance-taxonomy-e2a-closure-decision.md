# E2أ إغلاق — قرار

**الحكم:** `E2A_CLOSED_VERIFIED`

**code SHA المختبر:** `7d512998c131f31c994d9ca18ca865a323cd9e28`  
**البيئة:** Nest محلي + Postgres `127.0.0.1` + أصل بوابة ثابت منفصل عن API.

**النطاق:** E2-C01…C05 + ARCH 01–07 على الأجزاء المتأثرة. خارج النطاق: E2ب/ج، E3–E5، نشر إنتاج.

**الإصلاحات:**
- C01: parked bag في `registry-attribute-fields.js` عبر `captureEditorState` / `projectStateOntoDefs`
- C02: `attrRevAtSend` + `applyServerSnapshot({onlyClean:true})` في `catalog-journey.js`
- C03: `PartnersApi.taxonomy` فقط مع خطأ واضح وإعادة محاولة
- C04: `attrFieldIdsFromRegistry` / استخراج بالمعرّف→مفتاح التخزين
- C05: رحلة HTTP+preview+مكوّن + عدم رجوع E1؛ iPhone = E5 NOT_RUN

**الدليل:** `docs/elegance-taxonomy-e2a-developer-guide.md`  
**المرجع:** `docs/MIRA_Portal_Approved_Design_Notes.html`
