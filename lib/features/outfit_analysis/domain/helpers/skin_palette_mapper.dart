import '../../../skin_analysis/domain/entities/skin_report.dart';
import 'undertone_resolver.dart';

/// Maps skin profile → outfit palettes, fabrics, and accessories (deterministic).
class SkinPaletteProfile {
  final SkinUndertone undertone;
  final List<String> recommendedPalettes;
  final List<String> blockedPalettes;
  final List<String> fabricSuggestions;
  final List<String> accessorySuggestions;
  final List<String> skinIssueFlags;

  const SkinPaletteProfile({
    required this.undertone,
    required this.recommendedPalettes,
    required this.blockedPalettes,
    required this.fabricSuggestions,
    required this.accessorySuggestions,
    required this.skinIssueFlags,
  });
}

abstract final class SkinPaletteMapper {
  SkinPaletteMapper._();

  static SkinPaletteProfile fromSkinReport(SkinReport skin) {
    final undertone = UndertoneResolver.resolve(skin);
    final recommended = _undertonePreferred(undertone);
    final blocked = _undertoneAvoid(undertone);
    final fabrics = <String>[];
    final accessories = <String>[];
    final flags = <String>[];

    final oiliness = _oilinessLevel(skin);
    if (oiliness > 75) {
      blocked.add('أقمشة لامعة');
      fabrics.add('قطن مطفي · كتان · جرسي غير لامع');
      flags.add('high_oiliness');
    }

    final redness = _issueSeverity(skin, 'redness', skin.redness);
    if (redness > 70) {
      blocked.addAll(['أحمر ساطع', 'مرجاني قوي', 'وردي نيون']);
      flags.add('high_redness');
    }

    final pigmentation = _issueSeverity(skin, 'age_spot', skin.spots);
    if (pigmentation > 80) {
      recommended.add('تباين متوازن');
      fabrics.add('ألوان موحّدة قرب الوجه');
      flags.add('high_pigmentation');
    }

    final darkCircles = _issueSeverity(skin, 'dark_circle', skin.wrinkles);
    if (darkCircles > 70) {
      blocked.addAll(['رمادي داكن مطفأ', 'أسود كامل قرب الوجه']);
      recommended.addAll(['بيج', 'كريمي', 'ألوان مشرقة قرب الوجه']);
      flags.add('dark_circles');
    }

    final firmness = skin.concernScores['firmness'] ?? 65;
    if (firmness < 45) {
      accessories.add('ياقة أو V يفتح الوجه');
    }

    final brightness = skin.concernScores['radiance'] ?? 60;
    if (brightness < 50) {
      recommended.addAll(['أبيض عاجي', 'ذهبي خفيف']);
    }

    accessories.addAll(_undertoneAccessories(undertone));

    return SkinPaletteProfile(
      undertone: undertone,
      recommendedPalettes: _unique(recommended),
      blockedPalettes: _unique(blocked),
      fabricSuggestions: _unique(fabrics),
      accessorySuggestions: _unique(accessories),
      skinIssueFlags: flags,
    );
  }

  static List<String> _undertonePreferred(SkinUndertone undertone) {
    return switch (undertone) {
      SkinUndertone.warm => [
          'زيتوني',
          'بيج',
          'كريمي',
          'بني',
          'ذهبي',
          'وردي دافئ',
          'تراكوتا',
        ],
      SkinUndertone.cool => [
          'كحلي',
          'أبيض',
          'فضي',
          'لافندر',
          'أزرق',
          'زمردي',
        ],
      SkinUndertone.neutral => [
          'نود',
          'رمادي فاتح',
          'أبيض عاجي',
          'تركواز',
          'بيج',
        ],
    };
  }

  static List<String> _undertoneAvoid(SkinUndertone undertone) {
    return switch (undertone) {
      SkinUndertone.warm => [
          'رمادي بارد',
          'فضي',
          'أزرق ثلجي',
          'وردي نيون',
        ],
      SkinUndertone.cool => [
          'خردلي',
          'زيتوني',
          'برتقالي',
        ],
      SkinUndertone.neutral => [
          'تضارب ألوان قوي',
        ],
    };
  }

  static List<String> _undertoneAccessories(SkinUndertone undertone) {
    return switch (undertone) {
      SkinUndertone.warm => ['ذهبي', 'نحاسي'],
      SkinUndertone.cool => ['فضي', 'بلاتين'],
      SkinUndertone.neutral => ['ذهبي خفيف', 'فضي'],
    };
  }

  static int _oilinessLevel(SkinReport skin) {
    if (skin.oiliness > 0) return skin.oiliness.clamp(0, 100);
    final health = skin.concernScores['oiliness'];
    if (health != null) return (100 - health).clamp(0, 100);
    return 40;
  }

  static int _issueSeverity(SkinReport skin, String key, int fallbackField) {
    final health = skin.concernScores[key];
    if (health != null) return (100 - health).clamp(0, 100);
    return (fallbackField * 20).clamp(0, 100);
  }

  static List<String> _unique(List<String> items) {
    final seen = <String>{};
    final out = <String>[];
    for (final item in items) {
      if (seen.add(item)) out.add(item);
    }
    return out;
  }
}
