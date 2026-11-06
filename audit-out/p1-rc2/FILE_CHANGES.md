# ملفات RC2 (مقابل baseline `4c920f2`)

## API
- `mira-api/src/partners-portal/registry/registry.service.ts` — تحقق array/قوالب/fieldOverrides/publish
- `mira-api/src/partners-portal/registry/field-registry.v2.json` — `serviceProfile` + أنشطة
- `mira-api/src/partners-portal/registry/legacy-template-aliases.json` — مفاتيح Flutter
- `mira-api/src/partners-portal/registry/service-templates.catalog.json` — جديد
- `mira-api/src/partners-portal/registry/draft-values-mapping.ts` — جديد
- `mira-api/src/partners-portal/registry/registry.validation.schema-tests.ts` — جديد
- `mira-api/src/partners-portal/editor-drafts/editor-drafts.service.ts` — mapping + submit resume
- `mira-api/src/partners-portal/editor-drafts/service-profile.service.ts`
- `mira-api/src/partners-portal/editor-drafts/editor-v2-rc2.http.integration-tests.ts` — جديد
- `mira-api/prisma/schema.prisma` + migration `20261104010000_partner_editor_v2_p1_rc2`
- `mira-api/package.json` — scripts RC2

## بوابة
- `partners-portal/web/js/editor-v2.js` — عزل partnerId/sessionEpoch
- `partners-portal/web/js/catalog-journey.js` — autosave موحّد + materialize
- `partners-portal/web/dashboard.html` — لوحة مسودات
- `partners-portal/web/js/field-registry.v2.json` + aliases + catalog
- `partners-portal/web/js/editor-v2-isolation.tests.mjs` — جديد

## Flutter
- `lib/features/marketplace/domain/catalog_service_template.dart` — canonical answer keys
- `test/features/marketplace/service_profile_json_parse_test.dart`
