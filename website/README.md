# موقع ميرا (Frontend)

موقع تسويقي عربي RTL متصل بـ **mira-api** على Render.

## الصفحات

| ملف | المحتوى |
|-----|---------|
| `index.html` | الرئيسية — مميزات، إحصائيات، شركاء حية، نموذج تواصل |
| `privacy.html` | سياسة الخصوصية |
| `partners.html` | B2B + طلب شراكة |

## API (Backend)

Base: `https://mira-api-n4p3.onrender.com/api/v1`

| Method | Path | وصف |
|--------|------|-----|
| GET | `/website/features` | قائمة المميزات |
| GET | `/website/stats` | إحصائيات شركاء/منتجات |
| GET | `/website/partners-preview` | معاينة شركاء |
| POST | `/website/leads` | نموذج تواصل (يُحفظ في DB) |

غيّر الـ API في كل صفحة:

```html
<meta name="mira-api-base" content="https://YOUR-API.onrender.com/api/v1" />
```

## معاينة محلية

```bash
cd website
python3 -m http.server 8080
# افتح http://localhost:8080
```

## نشر على Render (Static Site)

1. New → **Static Site**
2. Root: `website`
3. Build: `echo ok` (أو فارغ)
4. Publish: `website`

أضف في **mira-api** Environment:

```
WEBSITE_CORS_ORIGINS=https://your-site.onrender.com
```

## الأصول

```bash
cp ../assets/images/mira_logo_full.png assets/
cp ../assets/icons/guest_icon.svg assets/
```
