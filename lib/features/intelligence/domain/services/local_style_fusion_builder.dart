import '../../../../core/ai/models/mira_occasion.dart';
import '../../../outfit_analysis/domain/entities/outfit_report.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/mira_style_report.dart';

/// Combines skin undertone with outfit colors for fusion guidance.
abstract final class LocalStyleFusionBuilder {
  LocalStyleFusionBuilder._();

  static StyleFusion fromSkinAndOutfit(SkinReport skin, OutfitReport outfit) {
    final undertoneEn = skin.undertoneEn.toLowerCase();
    final undertoneAr = skin.undertone.isNotEmpty ? skin.undertone : 'محايد';
    final recommended = _recommendedColors(undertoneEn);
    final avoid = _avoidColors(undertoneEn, outfit.dominantColors);
    final occasion =
        MiraOccasion.fromId(outfit.occasionId) ?? MiraOccasion.casual;

    return StyleFusion(
      enabled: true,
      undertoneAr: undertoneAr,
      undertoneEn: skin.undertoneEn.isNotEmpty ? skin.undertoneEn : 'Neutral',
      headlineAr: 'إطلالتك وبشرتك في تناغم',
      summaryAr:
          'بشرتك ${skin.skinType} ذات اللون $undertoneAr — '
          'الألوان ${recommended.take(3).join(' · ')} تبرز إشراقك مع ${outfit.styleCategory}.',
      recommendedColorsAr: recommended,
      avoidColorsAr: avoid,
      makeupHintAr: _makeupHint(undertoneEn),
      accessoryHintAr: _accessoryHint(undertoneEn, occasion),
    );
  }

  static List<String> _recommendedColors(String undertoneEn) {
    return switch (undertoneEn) {
      'warm' => ['ذهبي', 'عسلي', 'مرجاني', 'زيتوني', 'كراميل'],
      'cool' => ['فضي', 'ياقوتي', 'لافندر', 'أزرق ملكي', 'وردي بارد'],
      _ => ['بيج', 'نود', 'رمادي فاتح', 'أبيض عاجي', 'تركواز'],
    };
  }

  static List<String> _avoidColors(String undertoneEn, List<String> dominant) {
    final base = switch (undertoneEn) {
      'warm' => ['فضي بارد', 'رمادي رمادي'],
      'cool' => ['برتقالي قوي', 'أصفر ليموني'],
      _ => ['ألوان متضاربة جداً'],
    };
    if (dominant.length >= 3) {
      return [...base, 'مزج أكثر من 3 ألوان قوية'];
    }
    return base;
  }

  static String _makeupHint(String undertoneEn) {
    return switch (undertoneEn) {
      'warm' => 'نود دافئ أو خوخي — يوازن undertone الدافئ',
      'cool' => 'وردي بارد أو موف ناعم',
      _ => 'وردي محايد يومي',
    };
  }

  static String _accessoryHint(String undertoneEn, MiraOccasion occasion) {
    final metal = undertoneEn == 'cool' ? 'فضي' : 'ذهبي';
    final bag = switch (occasion) {
      MiraOccasion.wedding || MiraOccasion.eid => 'clutch أنيق',
      MiraOccasion.work || MiraOccasion.interview => 'حقيبة مهنية',
      _ => 'حقيبة يومية',
    };
    return 'أقراط $metal · $bag';
  }
}
