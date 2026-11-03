# تفعيل / تراجع P1 RC3

## تفعيل staging (ليس إنتاجًا هنا)

1. دمج `mira/p1-partner-editor-v2-rc3`.
2. `cd mira-api && npx prisma migrate deploy` (يشمل هجرات P1 RC1/RC2).
3. `MIRA_PARTNER_EDITOR_V2=true`.
4. نشر البوابة مع `api.js` / `editor-v2.js` / `field-registry.v2.json`.
5. تحقق تطابق `registryHash` قبل الكتابة.

## تراجع

1. `MIRA_PARTNER_EDITOR_V2=false`.
2. لا DROP للمسودات أو أعمدة القالب.
3. المسارات القديمة تبقى.
