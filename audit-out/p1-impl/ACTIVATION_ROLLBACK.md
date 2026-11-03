# تفعيل وتراجع P1

## تفعيل (staging أولًا — ليس إنتاجًا في هذا التكليف)

1. دمج فرع `mira/p1-partner-editor-v2`.
2. `prisma migrate deploy` (هجرة `20261103200000_partner_editor_v2_p1` إضافية فقط).
3. ضبط `MIRA_PARTNER_EDITOR_V2=true` على خدمة API.
4. نشر البوابة مع `field-registry.v2.json` و`editor-v2.js`.
5. التحقق: `GET /api/v1/partners-portal/registry` → `editorV2Enabled:true` وتطابق `registryHash`.

## تراجع تشغيلي

1. `MIRA_PARTNER_EDITOR_V2=false`.
2. تبقى مسارات CRUD/submit-review القديمة.
3. **لا** DROP لـ `partner_editor_drafts` أو أعمدة `service_profile_*` / `profile_id`.
4. بيانات المسودات والإجابات قابلة للاستعادة عند إعادة التفعيل.
