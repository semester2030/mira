# قرار إغلاق المرحلة E1 — أساس تصنيفات أناقتك

**القرار:** `E1_CLOSED_VERIFIED`  
**أساس E2:** جاهز من جهة الباك اند (تعريفات + تحقق + حفظ موحّد + taxonomy API).  
بنود واجهة البوابة E2 (`material[]` / `carryStyle` UX) تبقى مفتوحة كما هي — إصلاح باك اند لا يغلق تجربة البوابة تلقائيًا.

## المعرفات

| | |
|--|--|
| الفرع | `mira/elegance-e1-taxonomy-foundation` |
| base | `60d9134294f6db96bc0c55685066dc49301833ae` |
| رأس E1 foundation | `1ce240187efb5a09329fd536998081f2cfd43365` |
| إغلاق الملاحظات | (يُملأ بعد commit الإغلاق) |

## الملاحظات الأربع

| # | الملاحظة | الحالة | الدليل |
|---|----------|--------|--------|
| 1 | فقد الخصائص عند التعديل الجزئي | PASS | `mergeAttributesPatch` + A-* في `elegance-e1-closure.http.integration-tests.ts` |
| 2 | اختلاف فردي/مسودات/منشور | PASS | draft_* taxonomy + approve merge + B/C tests |
| 3 | ثغرات التحقق وnull | PASS | D-* + schema-tests |
| 4 | نقص اختبارات/مبالغة تقرير | PASS | suite كاملة + build/boot + migration proof |

## أوامر التحقق

```bash
cd mira-api
export DATABASE_URL='postgresql://mira:mira_secret@localhost:5432/mira_db?schema=public'
npx prisma migrate deploy
npm run test:elegance-e1
npm run build
# boot dist + GET /api/v1/marketplace/taxonomy?lane=elegance
node scripts/e1-migration-rollback-proof.mjs
```

## المتبقي خارج E1

- E2 واجهة البوابة: استرجاع `material[]` وتعديل `carryStyle` بعد إعادة الفتح.
- E4 كتابة الشنط/الأحذية.
- مجوهرات/أطفال/خدمات/حجوزات.
- نشر إنتاج / ترحيل بيانات إنتاج.
