# إضافة قاعدة لمستشار الاكتشاف

## 1) سجّل القاعدة في `rules.v1.json`

أضف صفًا بالحقول:

- `ruleId` مثل `R082`
- `liveSourceId` / `liveTargetIds` بمعرّفات taxonomy الحية
- `visibility`: `public_candidate` أو `preview`

لا تغيّر إصدار التطبيق إن كانت واجهة البطاقة ثابتة.

## 2) اربط الإشارة في `intent.ts` (إن لزم)

إن كانت الإشارة جديدة (كلمة/سياق)، أضف استخراجًا في `extractSignals` ومسارًا في `decideIntent` يعيد:

- `ruleIds`, `sourceId`, `targetIds`, `lane`/`lanes`, `kindFilter`, `q`
- `sessionPatch` لحفظ القيود للتصحيح اللاحق («بس مو…»)

البحث في `consultant-discovery.service.ts` يستخدم `targetIds` كـ `subcategory` (CSV=OR) و`lanes` لدمج الأقسام.

## 3) اختبر

```bash
npx tsx src/consultant-discovery/intent.schema-tests.ts
npx tsx src/consultant-discovery/study-acceptance.schema-tests.ts
```

أضف عبارة عربية في الاختبار تثبت: النوع، المدينة/الميزانية، و`targetIds`.

## 4) فعّل خلف العلم فقط

`MIRA_CONSULTANT_DISCOVERY_V1=true` على بيئة الاختبار. التفعيل العام خطوة منفصلة.

## 5) تحقق من البطاقة

من مستشار ميرا: أرسل الطلب → يجب أن تُحفظ البطاقة مع رسالة الجلسة → إعادة فتح المحادثة تعيد العرض → الضغط يفتح `CatalogRecordScope` بالمعرّف نفسه.
