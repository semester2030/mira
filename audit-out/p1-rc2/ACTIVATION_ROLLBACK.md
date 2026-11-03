# تفعيل وتراجع P1 RC2

## تفعيل (staging فقط ضمن هذا التكليف)

1. دمج `mira/p1-partner-editor-v2-rc2` (أو cherry-pick بعد RC1).
2. `cd mira-api && npx prisma migrate deploy`
   - يشمل `20261103200000_partner_editor_v2_p1` و`20261104010000_partner_editor_v2_p1_rc2`.
3. `MIRA_PARTNER_EDITOR_V2=true` على API.
4. نشر البوابة مع `editor-v2.js` و`field-registry.v2.json` و`service-templates.catalog.json`.
5. تحقق: `GET …/registry` → `editorV2Enabled:true` و`registryHash` متطابق مع البوابة.

## تراجع تشغيلي

1. `MIRA_PARTNER_EDITOR_V2=false`.
2. مسارات CRUD/submit-review القديمة تبقى.
3. **لا** DROP لـ `partner_editor_drafts` أو أعمدة `service_profile_*` / `submit_review_*`.
4. المسودات وحالة materialize/submit قابلة للاستئناف بعد إعادة التفعيل.

## لا يُفعَّل في هذا التسليم

- إنتاج
- تغيير إعدادات R2
- إعادة نشر محتوى withdrawn
