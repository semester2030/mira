# نتائج اختبار المرشّح `cd39439` (قبل النشر)

| اختبار | النتيجة | دليل |
|--------|---------|------|
| `nest build` | PASS | dist/main.js |
| `prisma migrate deploy` على DB فارغ | PASS — كل 45 ترحيلًا بما فيها `commerce_visits_rc4` | raw/migrate_fresh.txt |
| alt-cards final merge | PASS (8) | raw/alt_merge_tests.txt |
| alt-cards live HTTP | PASS (both/closed/withdrawn/search_failed) | raw/http_live_alts.txt |
| marketplace-offer-live-status | PASS | raw/live_status_schema.txt |
| commerce-visit schema | PASS | raw/visit_schema.txt |
| commerce visit DB integration | PASS — زيارة واحدة + خدمتان + idempotency | raw/visit_integration.txt |
| Flutter booking visit tests | PASS — 14 | raw/flutter_booking_tests.txt |
| بوابة المركز (ملفات المرشّح → API اختبار) | PASS — إنشاء خدمتين + وسائط + اعتماد إدارة + إغلاق حجز (منشور/booking=false) + سحب نشر | raw/portal_publish_close_withdraw.json |
| أسئلة سياقية بعد رد ناجح | **لم يُغلق هنا** — موجود على الإنتاج سابقًا؛ يلزم تحقق جهاز | — |
| فيديو اكتشفي / تفاصيل منتج | لم يُشغَّل على جهاز في هذه الجولة | — |

API اختبار البوابة: `http://127.0.0.1:3033/api/v1` · بوابة مرشّحة: `partners-portal/web` مع `mira-api-base` → الاختبار.
