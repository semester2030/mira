# 04 — خلفية ميرا بدل الأسود (`blackCompositePng`)

## مسار اليوم

```
source bytes (تحليل + مقارنة أصل)
        ↓
ApplePersonMattingChannel.generate
        ├─ alphaPng          ← قناع شخص رمادي
        └─ blackCompositePng ← شخص فوق #000 (عرض Face Explorer)
        ↓
results_skin_map_panel._faceOnlyBlackBytes
atmosphere / scaffold = SkinFaceMapVisualTokens.faceOnlyBlack
```

`renderBlackComposite` (Swift): لكل بكسل  
`out = src * maskAlpha + #000 * (1-maskAlpha)` مع حفظ RGB المصدر تحت القناع.

## المطلوب

- استبدال **#000** بلون/تدرج من هوية ميرا.
- عدم تعديل بكسلات البشرة (حيث mask≈1 يبقى src).
- التحليل يبقى على الأصل؛ الخلفية للعرض فقط.

## خياران من الهوية الفعلية

### الخيار A — Mist Blush (**مثبَّت للمراجعة البصرية 2026-09-17**)
- قاعدة: `AppColors.background` **`#FFF7FA`**
- تدرج اختياري رأسي خفيف إلى `AppColors.primaryLight` `#FADAE9` (5–12% عند الأسفل فقط في طبقة الخلفية، **ليس** على البشرة)
- طابع: نظيف، عيادي-أنيق، يُبرز تفاصيل البشرة والخريطة الملونة
- كروم الواجهة: نص `textPrimary` على فاتح بدل `explorerOnBlack`
- تصور تصميمي للمراجعة: `visuals/mira_face_explorer_design_mock_optionA_FFF7FA.png` (**DESIGN MOCK** — ليس ناتج تحليل)

### الخيار B — Rose Champagne
- قاعدة: مزج `primaryLight` `#FADAE9` مع لمسة `goldLight` `#F5E6B8` عند الحافة السفلية للخلفية فقط
- طابع: أكثر دفئاً وأنوثة فاخرة
- يحافظ على تباين كافٍ مع `analysis*` إن بقيت شفافية الأقنعة الحالية

**لا يُقترح:** بنفسجي داكن (`darkBackground`) أو أسود فاخر — خارج طلب «بدل الأسود بطابع نسائي أنيق» من الهوية الوردية/الذهبية.

## مسارا تنفيذ محتملان (اختيار عند التنفيذ)

| مسار | أين | إيجابيات | مخاطر |
|------|-----|----------|--------|
| **S1 — Swift composite** | تعميم `renderBlackComposite` → لون RGB قابل للتمرير؛ أو `renderBrandComposite` | بكسل واحد متسق للمكبّر | يحتاج بناء iOS؛ تدرج معقّد أكثر |
| **S2 — Flutter layer** | استخدام `alphaPng` + `ColorFiltered`/`ShaderMask` أو stack: خلفية ميرا → صورة مصدر بـ DestinationIn من alpha → قناع Perfect | أسرع للتجربة؛ التدرج سهل | يجب ضمان نفس أبعاد/محاذاة المكبّر |

التوصية الدراسية: **S1 للون الصلب (A)** للاتساق مع المكبّر الحالي الذي يقرأ بايتات مركّبة؛ أو الإبقاء على `blackComposite` كمفتاح تاريخي مع إضافة `brandCompositePng` جديد دون كسر الجسور.

## ملفات للمسّ

1. `ios/Runner/ApplePersonMattingChannel.swift` — `renderBlackComposite` / مفتاح نتيجة جديد
2. `lib/.../apple_person_matting_poc_bridge.dart` — حقول النتيجة
3. `lib/.../results_skin_map_panel.dart` — `_faceOnlyBlackBytes` → بايتات عرض ميرا؛ ألوان `atmosphere` / scaffold
4. `skin_face_map_visual_tokens.dart` — استبدال/`deprecate` `faceOnlyBlack` كافتراض إنتاج؛ إبقاء الأسود لتشخيص الهالة فقط إن لزم

## قبول بصري

- حافة الشعر/الفك: لا هالة وردية داخل البشرة (الماتّة خارج الشخص فقط).
- ضغط مطوّل: أصل كامل بخلفية الغرفة.
- التحليل: نفس ملف الالتقاط الأصلي.
