import 'package:flutter/material.dart';

/// Story chapters for the outfit result experience.
enum OutfitResultChapter {
  look(
    id: 'look',
    titleAr: 'إطلالتك',
    icon: Icons.photo_camera_rounded,
    hintAr: 'لمسي الصورة لاكتشاف القطع',
  ),
  colors(
    id: 'colors',
    titleAr: 'ألوانك',
    icon: Icons.palette_rounded,
    hintAr: 'جرّبي سحب الشريط لمعاينة لون بديل',
  ),
  play(
    id: 'play',
    titleAr: 'جرّبي',
    icon: Icons.swipe_rounded,
    hintAr: 'اسحبي يميناً أو يساراً لاختيار القطعة الأنسب',
  ),
  wardrobe(
    id: 'wardrobe',
    titleAr: 'دولابك',
    icon: Icons.checkroom_rounded,
    hintAr: 'احفظي القطع المفضّلة في دولابك الخاص',
  );

  const OutfitResultChapter({
    required this.id,
    required this.titleAr,
    required this.icon,
    required this.hintAr,
  });

  final String id;
  final String titleAr;
  final IconData icon;
  final String hintAr;

  static const all = OutfitResultChapter.values;

  static String miraVoiceFor(OutfitResultChapter chapter, int tick) {
    final lines = switch (chapter) {
      OutfitResultChapter.look => [
        'إطلالتك تحكي قصة — لنكتشفها معاً',
        'كل قطعة لها سبب — لمسي الصورة',
        'الدرجة الكلية تجمع كل التفاصيل',
      ],
      OutfitResultChapter.colors => [
        'اللون الصحيح يرفع إشراق وجهك',
        'جرّبي السحب لترى الفرق على صورتك',
        'ألوانك الحالية لها شخصية مميزة',
      ],
      OutfitResultChapter.play => [
        'اختاري ما يناسب ذوقك — بدون ضغط',
        'اسحبي ببطء وقارني الإحساس',
        'القطعة الأنسب تظهر من تفاعلك',
      ],
      OutfitResultChapter.wardrobe => [
        'دولابك الخاص — على جهازك فقط',
        'احفظي ما يعجبك للمراجعة لاحقاً',
        'لا مشاركة — خصوصيتك أولاً',
      ],
    };
    return lines[tick % lines.length];
  }

  static String completionMessage(OutfitResultChapter chapter) {
    return switch (chapter) {
      OutfitResultChapter.look => 'اكتشفتِ إطلالتك ✨',
      OutfitResultChapter.colors => 'عرفتِ ألوانك 🎨',
      OutfitResultChapter.play => 'جرّبتِ بدائل رائعة 👗',
      OutfitResultChapter.wardrobe => 'دولابك جاهز 💫',
    };
  }
}
