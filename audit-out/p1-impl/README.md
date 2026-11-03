# MIRA P1 Partner Editor Implementation RC1 — 20261103

## Verdict

| جزء | الحالة |
|---|---|
| P1.1 سجل الحقول | **IMPLEMENTED** + **PASS_LOCAL** |
| P1.2 مسودات خادمية + materialize | **IMPLEMENTED** + **PASS_LOCAL** |
| P1.3 قوالب خدمات + استيراد + Flutter قراءة | **IMPLEMENTED** + **PASS_LOCAL** (جهاز: **NOT_RUN**) |
| Staging E2E شريك حي | **NOT_RUN** |
| إنتاج | **غير منشور** ضمن هذا التكليف |

## تصحيحات العقود الأربعة

1. **اختيارية الحقول:** مفاتيح `draftRequired` / `publishRequiredWhen`؛ مسودة `values:{}` مقبولة؛ `nameAr` ليس شرط حفظ.
2. **materialize:** يتطلب `expectedRevision` + `materializedAt` + قفل صف؛ Idempotency-Key لا يكفي وحده بين مفتاحين.
3. **قالب/استيراد:** `expectedRevision` ذري؛ `force=true` لا يتجاوز إصدارًا أحدث بعد المعاينة.
4. **تراجع:** `MIRA_PARTNER_EDITOR_V2=false` مع الإبقاء على البيانات؛ بلا DROP في الخطة المعتادة.

## تفعيل / تراجع

- تفعيل staging: `MIRA_PARTNER_EDITOR_V2=true` + `prisma migrate deploy`.
- تراجع تشغيلي: العلم `false`؛ المسارات القديمة تبقى؛ صفوف `partner_editor_drafts` وأعمدة `service_profile_*` تُحفظ.

## إعادة التحقق

```bash
cd mira-api
export DATABASE_URL='postgresql://…@localhost…'
npm run check:field-registry
npm run test:editor-v2
cd .. && flutter test test/features/marketplace/service_profile_json_parse_test.dart
```

## حدود

- حادثة الوسائط مستقلة (خارج P1).
- لا رفع موقّع / UploadSession / مخزون تركيبات / فلاتر P5.
- اختبار staging الشريك وdevice Flutter: متبقي (لا يمنع اكتمال التنفيذ المحلي).
