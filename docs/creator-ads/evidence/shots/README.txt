لقطات التسليم (v1 verify)

00-orb-source.jpg — أصل دائرة المشاهير المدمج في التطبيق
01-home-celebrities-orb.png — تركيب توضيحي: الدائرة فوق «اكتشفي عالم ميرا» (أصل الصورة الحقيقي)
02-celebrities-directory-6.png — تركيب 2×3 لبداية الدليل
03-directory-seven-scroll.png — تركيب يوضح السابع بالتمرير
04-celebrity-profile-empty.png — حالة «لا توجد إعلانات منشورة بعد»

إثبات آلي (ليس لقطة جهاز):
- celebrities_home_orbit_test.dart PASS — الدائرة فوق العنوان + الضغط يفتح الدليل
- celebrities_directory_layout_test.dart PASS — 3 أعمدة + السابع يظهر بعد التمرير
- creator-ads.v1.http.integration-tests.ts PASS — ملف + ٣ فيديو + فيديو/١٠ صور + دليل ٧ + عزل

لقطات جهاز/بوابة حيّة: كرّر يدويًا من حساب المطوّر (خطوات FAYEZ_REPEAT.md).
toImage في اختبار Flutter يعلّق في هذه البيئة — لا يُعتمد عليه.
