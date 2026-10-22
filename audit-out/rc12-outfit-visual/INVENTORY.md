# RC12 Outfit Visual — inventory

Reference: agent assets `2d30e553-…jpg` (4-screen Mira outfit mockup)

| مطلب | الحالة | ملف |
|---|---|---|
| 4 تبويبات + طي الصورة + اسألي ميرا | موجود ويحتاج تطويراً بصرياً | `outfit_studio_screen.dart` |
| سجل أيقونات الأزياء SVG/Phosphor | موجود ويعمل — يُعاد استخدامه للأفعال | `mira_fashion_icon_registry.dart` |
| رسوم قطع موضحة (فستان/حقيبة/حذاء…) | ناقص → أُضيف | `assets/icons/fashion/illustrations/*.png` + `outfit_piece_art.dart` |
| فهرس صور محلية للسجل | ناقص → أُضيف | `outfit_local_image_index.dart` |
| دوائر ألوان برمجية | موجود ويعمل | `FashionColorBinding` |
| إصلاح حفظ 400 / نبيتي | موجود من RC11 | لا إعادة عمل |

Generated illustrations (transparent PNG 256): dress, blouse, skirt, pants, abaya, bag, heel, jewelry, belt, scarf.
Note: generator returned JPG with white bg; knockout applied → PNG alpha≈0.8 transparent.
Fallback: MiraFashionIcon registry when illustration missing.
