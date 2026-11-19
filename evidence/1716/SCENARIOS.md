# سيناريوهات جهاز — 1716

بعد التثبيت والتشغيل، سجّل الشاشة مع السجل لنفس الجلسة:

1. تحميل جديد (مقطع لم يُخزَّن)
2. سحب سريع عبر عدة مقاطع
3. رجوع بعد ≥20 مقطعًا لمقطع مكتمل
4. خروج Discover والعودة
5. تحقق صوت: مقطع واحد مسموع؛ لا صوت للمغادر

ابحث في السجل عن:
- `MIRA_BUILD_IDENTITY build=2026111716`
- `seek_nudge_done` قبل أي `FF` لنفس attempt
- `unmute_req` مرة واحدة لكل attempt
- `proxy_kick_prefix` بدل full ensureLocal قبل التقدم
- `MIRA_DISCOVER_ATTEMPT … phase=end outcome=` لكل محاولة بما فيها left_dark

لا محاكي · لا مسح بيانات · لا نشر عام.
