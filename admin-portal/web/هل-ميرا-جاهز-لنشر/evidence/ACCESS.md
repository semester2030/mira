# هل ميرا جاهز لنشر — الوصول (إدارة فقط)

## الرابط
- **المسار:** `admin-portal/web/mira-store-gate/` (واسم عربي `هل-ميرا-جاهز-لنشر`)
- **بعد نشر بوابة الإدارة:** `https://mira-admin-portal.onrender.com/mira-store-gate/`
- **من لوحة الإدارة:** عنصر القائمة «هل ميرا جاهز لنشر»

## الدخول
- يتطلب **مفتاح الإدارة** (`X-Admin-Key` / `ADMIN_API_KEY`).
- السجل والتقارير تُحمَّل من:
  - `GET /api/v1/admin/store-readiness`
  - `GET /api/v1/admin/store-readiness/clip-perf`
- الملفات الثابتة تحت `data/` و`evidence/` العامة تعرض `PROTECTED` فقط.

## إثبات الزائر
طلب بدون مفتاح إلى `/api/v1/admin/store-readiness` يجب أن يعود `401/403`.
الملفات العامة `RESULTS_LEDGER.json` و`CLIP_PERF_AND_INTERACTION.json` تُرجع `"error":"PROTECTED"`.
