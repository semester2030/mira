# partners.mira.app

بوابة B2B لشركاء ميرا — **أتمتة كاملة، بدون تعقيد**.

## التدفق الآلي

```
تقديم (apply) → pending
     ↓
Admin يعتمد (X-Admin-Key) → Partner + PartnerUser + accessToken (تلقائي)
     ↓
الشريك يدخل (email + token) → يضيف منتجات/خدمات
     ↓
تظهر في التطبيق (marketplace/match) + تتبع نقرات
```

## الواجهة (`web/`)

| صفحة | الوظيفة |
|------|---------|
| `index.html` | Landing |
| `apply.html` | طلب انضمام |
| `status.html?token=...` | تتبع الحالة + استلام accessToken |
| `login.html` | دخول الشريك |
| `dashboard.html` | كتalog + إحصائيات 30 يوم |
| `admin.html` | اعتماد/رفض الطلبات (داخلي) |

## API (`mira-api`)

Base: `https://mira-api-n4p3.onrender.com/api/v1`

| Method | Path | Auth |
|--------|------|------|
| POST | `/partners-portal/apply` | — |
| GET | `/partners-portal/apply/status/:token` | — |
| POST | `/partners-portal/login` | — |
| POST | `/partners-portal/track` | — |
| GET | `/partners-portal/me` | Bearer token |
| POST/PATCH/DELETE | `/partners-portal/products/*` | Bearer |
| POST/PATCH/DELETE | `/partners-portal/services/*` | Bearer |
| GET | `/partners-portal/admin/applications` | X-Admin-Key |
| POST | `/partners-portal/admin/applications/:id/approve` | X-Admin-Key |
| POST | `/partners-portal/admin/applications/:id/reject` | X-Admin-Key |

## متغيرات البيئة (Render)

```
ADMIN_API_KEY=...          # اعتماد الطلبات
PARTNER_AUTO_APPROVE=false # true للتجربة المحلية فقط
WEBSITE_CORS_ORIGINS=https://mira-partners-portal.onrender.com,...
```

## نشر

- **Frontend:** Render Static → `partners-portal/web` (Blueprint: `mira-partners-portal`)
- **Backend:** نفس `mira-api` — `npx prisma migrate deploy` عند النشر

## المواصفات الكاملة

[`SPEC.md`](./SPEC.md)
