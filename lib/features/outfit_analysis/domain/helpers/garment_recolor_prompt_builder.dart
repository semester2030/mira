import 'garment_recolor_vision_context.dart';

/// Client-side mirror of [GarmentRecolorPromptService] v2 — Phase Q0.
abstract final class GarmentRecolorPromptBuilder {
  static const colorHex = <String, String>{
    'أسود': '#1A1A1A',
    'أبيض': '#F5F5F5',
    'بيج': '#D2BEA0',
    'كريمي': '#EBE0C8',
    'رمادي': '#9E9E9E',
    'كحلي': '#1A2848',
    'أزرق': '#3F51B5',
    'زيتوني': '#6B7040',
    'ذهبي': '#C8A850',
    'وردي': '#E699B0',
    'أحمر': '#B42832',
    'نبيتي': '#781828',
    'بني': '#785032',
    'فضي': '#BEBEC8',
    'تركواز': '#3CAAA0',
    'مرجاني': '#F07864',
    'دنيم': '#5B7FA8',
  };

  static const garmentOptions = [
    'فستان',
    'بلوزة',
    'عباءة',
    'تنورة',
    'جاكيت',
    'بنطلون',
    'جينز',
  ];

  static String build({
    required String garmentLabelAr,
    required String targetColorAr,
    String? targetColorHex,
    GarmentRecolorVisionContext? visionContext,
  }) {
    final garment = garmentLabelAr.trim().isEmpty ? 'القطعة العلوية' : garmentLabelAr.trim();
    final color = targetColorAr.trim();
    final hex = targetColorHex?.trim() ?? colorHex[color] ?? '#888888';
    final role = visionContext?.regionRole ?? 'upper';

    return [
      'أعدي تلوين $garment ($role) في هذه الصورة إلى $color ($hex).',
      '',
      _materialLine(visionContext),
      _geometryLine(visionContext),
      '• المطلوب: تغيير طبقة الصبغة فقط — لا تغيّري نسيج الألياف ولا سلوك القماش.',
      '• المحظور تماماً: الوجه، الشعر، البشرة، اليدين، الخلفية، الحذاء، الحقيبة، المجوهرات، وملامح الجسم.',
      '• الجودة: إخراج واقعي بأسلوب تصوير أزياء فاخر — بدون فلاتر أو تجميل للوجه.',
      '• الحواف: لون $color موحّد على $garment مع حواف نظيفة عند خط الفصل مع الجلد — zero bleeding.',
    ].where((l) => l.isNotEmpty).join('\n');
  }

  static String _materialLine(GarmentRecolorVisionContext? ctx) {
    final conf = ctx?.materialConfidence ?? 0;
    if (ctx?.material != null && conf >= 0.6) {
      return '• الخامة: حافظي على خامة ${ctx!.material} — تغيير لون الصبغة فقط.';
    }
    if (ctx?.glossLevel == 'glossy') {
      return '• الخامة: حافظي على الانعكاسات الطبيعية للقماش اللامع.';
    }
    if (ctx?.glossLevel == 'matte') {
      return '• الخامة: حافظي على القماش المطفي — لا تحوّليها إلى لامع.';
    }
    return '• الخامة: إن كان القماش لامعاً فحافظي على الانعكاسات؛ إن كان مطفياً فلا تزيدي اللمعان.';
  }

  static String _geometryLine(GarmentRecolorVisionContext? ctx) {
    final parts = <String>[];
    if (ctx?.foldDensity == 'high') {
      parts.add('كثافة الثنيات الطبيعية في الكتف والصدر');
    } else if (ctx?.fit != null) {
      parts.add('قصة ${ctx!.fit}');
    }
    if (ctx?.silhouetteHint != null && ctx!.silhouetteHint!.isNotEmpty) {
      parts.add('silhouette: ${ctx.silhouetteHint}');
    }
    if (ctx?.pieceCount != null && ctx!.pieceCount! > 0) {
      parts.add('pieces: ${ctx.pieceCount}');
    }
    if (parts.isEmpty) {
      return '• الهندسة: حافظي على ثنيات القماش الطبيعية وقصّة القطعة كما هي.';
    }
    return '• الهندسة: حافظي على ${parts.join(' · ')} — لا تسطّحي الطيات.';
  }

  static String userMessage({
    required String garmentLabelAr,
    required String targetColorAr,
  }) {
    final garment = garmentLabelAr.trim().isEmpty ? 'القطعة' : garmentLabelAr.trim();
    return 'أعدنا تلوين $garment إلى $targetColorAr — بإطلالة طبيعية تحافظ على هويتك';
  }
}
