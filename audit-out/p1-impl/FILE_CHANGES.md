# الملفات المعدّلة / المضافة (P1)

## API
- `mira-api/prisma/schema.prisma` — PartnerEditorDraft + profile/service_profile columns
- `mira-api/prisma/migrations/20261103200000_partner_editor_v2_p1/` — migration إضافية
- `mira-api/src/partners-portal/registry/*` — سجل الحقول + RegistryService
- `mira-api/src/partners-portal/editor-drafts/*` — مسودات، materialize، service-profile، اختبارات
- `mira-api/src/partners-portal/partners-portal.controller.ts` / `.module.ts`
- `mira-api/src/marketplace/catalog-content.service.ts` — اعتماد draft_service_profile_*
- `mira-api/src/marketplace/marketplace.service.ts` — كشف serviceProfileJson العام فقط
- `mira-api/nest-cli.json` — نسخ JSON السجل إلى dist
- `mira-api/scripts/check-field-registry-sync.mjs`
- `mira-api/package.json` / `.env.example`

## بوابة
- `partners-portal/web/js/field-registry.v2.json` (+ aliases)
- `partners-portal/web/js/editor-v2.js` — autosave + استيراد
- `partners-portal/web/js/api.js` / `catalog-journey.js` / `dashboard.html`

## Flutter
- `lib/.../catalog_service_template.dart` — fromServiceProfileJson
- `lib/.../marketplace_api_data_source.dart` — ربط parser
- `test/.../service_profile_json_parse_test.dart`

## عقود
- `contracts/p1/P1_DECISIONS.md`
- `contracts/p1/p1-api.v2.json`
