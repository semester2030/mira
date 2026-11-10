# بوابة ميرا — إصلاح بنية العرض (غلاف موحّد)

تاريخ الأدلة: 2026-11-10 · فرع `mira/elegance-e1-taxonomy-foundation`

| المشكلة | الإصلاح | دليل القبول |
|---|---|---|
| الأقسام تتتابع في صفحة طويلة + تنقل بـ`scrollIntoView` | `portal-shell.js`: قائمة جانبية يمين + قسم نشط واحد + `#/view[/edit]` و`pushState`/`popstate` | `portal-shell.structure.tests.mjs` + لقطات `audit-out/portal-shell-layout/*-list.png` و`*-drafts.png`؛ 57/57 فحص متصفح |
| القائمة والمحرر يظهران معًا | أوضاع `list`/`edit` حصرية لـ`e2bListPanel`/`e2bEditorPanel` و`serviceListWrap`/`serviceEditorWrap`؛ CSS `portal-mode-*` | فحوصات `list-not-editor` و`edit-hides-list` على 1366/1440/390 |
| سطح المكتب يوسّع كل الحقول عبر `!narrow` | تبويبات أفقية دائمة للمنتج (أساسيات / خيارات ومخزون / وسائط / تفاصيل) والخدمة (أساسيات / مكان / إتاحة / وسائط) | `single-tab-fields` + `offer-hides-basics`؛ لقطات `*-edit-basics.png` و`*-edit-offer.png` |
| المسودات تعرض `rev`/`materialized`/`localStorage` | بطاقات عربية: الاسم · النوع · الحالة · آخر تعديل · فتح؛ المعرفات التقنية في `data-*` فقط | `dashboard.html` بلا `· rev`؛ لقطة `*-drafts.png` |
| الصالون/العيادة تخدم من `catalogForm` بينما الغلاف يفتح `serviceSection` | `usesCatalogAsServices()` يوجّه الخدمات إلى `catalogSection` | وحدة بنية + مسار تنقل الخدمات |
| مغادرة تعديل غير محفوظ | `setDirtyGuard` + `dataset.dirty` + `beforeunload` + `mira:draft-saved` | موجود في `dashboard.html` / `editor-v2.js` / `portal-shell.js` |

أدلة التشغيل: `audit-out/portal-shell-layout/results.json` · اختبار البنية: `node partners-portal/web/js/portal-shell.structure.tests.mjs`
