# admin.mira.app — لوحة إدارة ميرا

لوحة داخلية لفريق ميرا — **Ops · Partners · System**

## الوحدات

| Module | المحتوى |
|--------|---------|
| **Ops** | Dashboard · Users · Audit · Feedback |
| **Partners** | Applications · Partners · Website Leads |
| **System** | Providers · Feature flags · Security |

## التشغيل المحلي

```bash
# 1. Backend
cd mira-api
# ADMIN_API_KEY=your-secret-key in .env
npm run start:dev

# 2. Admin portal (static)
cd admin-portal/web
python3 -m http.server 8090
# افتح http://localhost:8090
```

عدّل `meta[name=mira-api-base"]` في `index.html` أو استخدم نفس origin مع CORS.

## API

Base: `/api/v1/admin/*` — Header: `X-Admin-Key`

| Method | Path |
|--------|------|
| GET | `/admin/stats/overview` |
| GET | `/admin/stats/analyses-trend` |
| GET | `/admin/stats/audit-actions` |
| GET | `/admin/users` |
| GET | `/admin/users/:id` |
| GET | `/admin/audit-logs` |
| GET | `/admin/feedback` |
| GET | `/admin/partners` |
| PATCH | `/admin/partners/:id/status` |
| GET | `/admin/partners/applications` |
| POST | `/admin/partners/applications/:id/approve` |
| POST | `/admin/partners/applications/:id/reject` |
| GET | `/admin/leads` |
| GET | `/admin/system/config` |

## النشر (Render)

Blueprint: `mira-admin-portal` static site → `admin-portal/web`

Env على `mira-api`:
```
ADMIN_API_KEY=...
WEBSITE_CORS_ORIGINS=...,https://mira-admin-portal.onrender.com
```

## الأمان

- لا ترفعي `ADMIN_API_KEY` إلى Git
- لا تعرضي صور المستخدمات — metadata فقط
- كل إجراء admin يُسجّل في `audit_logs`
