# E2أ إغلاق — قرار (B01.1 / B01.2 / B02.1 / T01)

**الحكم:** `E2A_CLOSED_VERIFIED`

**Code SHA المختبر:** `cb108867c59a503cf6e44a76b456c38b88cb5f62`  
**Delivery SHA:** commit توثيق المرجع بعد هذا الملف (إن وُجد منفصلًا).

## ما أُغلق في هذه الجولة

| بند | الإصلاح |
|-----|---------|
| B01.1 | ربط جلسة الرفع بهوية الملف؛ إلغاء عند ملف مختلف؛ استئناف نفس الملف |
| B01.2 | `previewGen` + معاينة غير حاجزة؛ لا اختلاط بطاقات ولا طمس ملف محلي |
| B02.1 | مسح صريح لـ subcategory/وصف؛ لا إسقاط truthy لـ `[]` |
| T01 | استئناف من واجهة حقيقية بلا حقن حالة |
| سلبي/ACL/حزمة | كواشف عطل حقيقية؛ ACL وسائط؛ fixture بديل موثّق |

## بوابة القبول

```bash
cd mira-api
DATABASE_URL='postgresql://mira:mira_secret@localhost:5432/mira_db' \
  MIRA_PARTNER_EDITOR_V2=true MIRA_PARTNER_UPLOAD_SESSION=true \
  MIRA_UPLOAD_ALLOW_DIRECT_PARTS=true \
  npx tsx src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts
```

النتيجة على Code SHA أعلاه: `E2A_ACCEPTANCE_PASS` (كل ACC-* الإلزامية).

**NOT_RUN:** iPhone الفعلي (E5). لا إعلان إنتاج/R2.

**المرجع:** `docs/MIRA_Portal_Approved_Design_Notes.html`  
**الدليل:** `docs/elegance-taxonomy-e2a-developer-guide.md`
