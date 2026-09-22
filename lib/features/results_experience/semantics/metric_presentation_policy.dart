import '../contracts/result_enums.dart';
import '../contracts/result_presentation_vms.dart';
import '../visibility/advice_ownership_policy.dart';

/// Presentation helpers for metric meaning / owned action (Phase 8D).
abstract final class MetricPresentationPolicy {
  /// Metrics where the primary public meaning is concern intensity (higher worse).
  static const severityPrimaryIds = {
    'acne',
    'redness',
    'pigmentation',
    'wrinkles',
    'pore',
    'pores',
    'oiliness',
    'oil',
    'spots',
  };

  static String rawMetricId(ResultMetricVM m) =>
      m.id.replaceFirst('metric_', '');

  static bool isSeverityPrimary(ResultMetricVM m) {
    final id = rawMetricId(m).toLowerCase();
    return severityPrimaryIds.any((e) => id.contains(e));
  }

  static ResultScoreView? primaryScore(ResultMetricVM m) {
    if (isSeverityPrimary(m)) return m.severityOrWellness ?? m.condition;
    return m.condition ?? m.severityOrWellness;
  }

  static String publicStatusAr(ResultMetricVM m) {
    if (!m.evidenceAvailable) return 'غير متاح';
    final primary = primaryScore(m);
    if (primary == null) return m.statusLabelAr;
    if (isSeverityPrimary(m) && primary.value != null) {
      return severityStatusPublicAr(primary.value!);
    }
    return primary.statusLabelAr.isNotEmpty
        ? primary.statusLabelAr
        : m.statusLabelAr;
  }

  static String directionHintAr(ResultMetricVM m) {
    if (isSeverityPrimary(m)) {
      return 'رقم أعلى يعني احتياجاً أوضح للعناية';
    }
    return 'رقم أعلى يعني حالة أفضل';
  }

  static String whyMattersAr(ResultMetricVM m) => whyMattersForId(rawMetricId(m));

  static String whyMattersForId(String metricId) {
    final id = metricId.toLowerCase();
    if (id.contains('moisture') || id.contains('hydrat')) {
      return 'الترطيب يؤثر على نعومة البشرة وراحتها اليومية.';
    }
    if (id.contains('acne')) {
      return 'متابعة مظهر الحبوب تساعد على اختيار عناية ألطف وأكثر ثباتاً.';
    }
    if (id.contains('redness')) {
      return 'تقليل التهيج الظاهر يحسّن راحة البشرة ومظهرها.';
    }
    if (id.contains('pigment') || id.contains('spot')) {
      return 'متابعة التصبغ تدعم اختيار حماية لطيفة وثابتة.';
    }
    if (id.contains('pore')) {
      return 'مظهر المسام يرتبط غالباً بالتنظيف اللطيف وتنظيم الدهون.';
    }
    if (id.contains('wrinkle')) {
      return 'مظهر الخطوط يتأثر بالترطيب وعادات العناية اليومية.';
    }
    if (id.contains('oil')) {
      return 'توازن الدهون يقلل اللمعان الزائد والجفاف التعويضي.';
    }
    if (id.contains('texture')) {
      return 'الملمس يعكس نعومة السطح وانتظام مظهر البشرة.';
    }
    return 'فهم هذا المؤشر يساعدك على اختيار خطوة عناية واحدة واضحة.';
  }

  static String actionForId(String metricId) {
    final id = metricId.toLowerCase();
    if (id.contains('moisture') || id.contains('hydrat')) {
      return 'رطّبي بتركيبة لطيفة صباحاً ومساءً';
    }
    if (id.contains('acne')) {
      return 'التزمي بتنظيف لطيف وتجنّبي فرك المنطقة';
    }
    if (id.contains('redness')) {
      return 'خفّفي المنتجات القوية وركّزي على تهدئة البشرة';
    }
    if (id.contains('pigment') || id.contains('spot')) {
      return 'واظبي على حماية من الشمس بلطف يومياً';
    }
    if (id.contains('pore') || id.contains('oil')) {
      return 'استخدمي منظفاً لطيفاً دون تجفيف زائد';
    }
    if (id.contains('wrinkle') || id.contains('texture')) {
      return 'ادعمي النعومة بترطيب ثابت ومنتظم';
    }
    return 'اختاري خطوة عناية واحدة مرتبطة بهذا المؤشر';
  }

  static String ownedActionAr(ResultMetricVM m) {
    if (m.recommendedActionAr != null &&
        m.recommendedActionAr!.trim().isNotEmpty) {
      return m.recommendedActionAr!.trim();
    }
    return actionForId(rawMetricId(m));
  }

  static String adviceConceptId(ResultMetricVM m) {
    final id = rawMetricId(m).toLowerCase();
    if (id.contains('moisture') || id.contains('hydrat')) return 'hydration';
    if (id.contains('acne')) return 'acne_care';
    if (id.contains('redness')) return 'redness_care';
    if (id.contains('pigment') || id.contains('spot')) {
      return 'pigmentation_care';
    }
    if (id.contains('pore')) return 'pore_care';
    if (id.contains('oil')) return 'gentle_cleanser';
    return 'moisturizer';
  }

  static AdviceOwner owner(ResultMetricVM m) =>
      AdviceOwnershipPolicy.ownerFor(adviceConceptId(m));

  static String publicLabelAr(String concernOrMetricId) {
    final id = concernOrMetricId.toLowerCase().replaceFirst('metric_', '');
    if (id.contains('dark_circle') || id.contains('هالات')) return 'الهالات';
    if (id.contains('eye_bag') || id.contains('انتفاخ')) return 'انتفاخ العين';
    if (id.contains('droopy_upper')) return 'الجفن العلوي';
    if (id.contains('droopy_lower')) return 'الجفن السفلي';
    if (id.contains('tear_trough')) return 'تحت العين';
    if (id.contains('firmness')) return 'الصلابة';
    if (id.contains('radiance') || id.contains('إشراق')) return 'الإشراق';
    if (id.contains('moisture') || id.contains('hydrat') || id.contains('ترطيب')) {
      return 'الترطيب';
    }
    if (id.contains('acne') || id.contains('حبوب')) return 'الحبوب';
    if (id.contains('redness') || id.contains('احمرار')) return 'الاحمرار';
    if (id.contains('pigment') ||
        id.contains('age_spot') ||
        id.contains('dark_spot') ||
        (id.contains('spot') && !id.contains('circle')) ||
        id.contains('تصبغ')) {
      return 'التصبغات';
    }
    if (id.contains('pore') || id.contains('مسام')) return 'المسام';
    if (id.contains('wrinkle') || id.contains('تجاعيد') || id.contains('خطوط')) {
      return 'التجاعيد';
    }
    if (id.contains('oil') || id.contains('دهون')) return 'الدهون';
    if (id.contains('texture') || id.contains('ملمس')) return 'الملمس';
    if (id.contains('skin_type') || id.contains('نوع')) return 'نوع البشرة';
    // Never leak provider / technical ids into consumer UI.
    return 'مؤشر البشرة';
  }

  /// ONE canonical subregion presentation map (Arabic consumer labels).
  static String subregionLabelAr(String regionKey) {
    switch (regionKey.toLowerCase()) {
      case 'whole':
      case 'all':
        return 'الكل';
      case 'forehead':
        return 'الجبهة';
      case 'nose':
        return 'الأنف';
      case 'cheek':
        return 'الخد';
      case 'glabellar':
        return 'بين الحاجبين';
      case 'crowfeet':
        return 'حول العين الخارجي';
      case 'periocular':
        return 'حول العين';
      case 'nasolabial':
        return 'خطوط الابتسامة';
      case 'marionette':
        return 'خطوط أسفل الفم';
      default:
        return 'منطقة';
    }
  }

  /// Concise Face Explorer context — non-medical, non-technical.
  static String faceExplorerHintAr(String concernOrMetricId) {
    final id = concernOrMetricId.toLowerCase();
    if (id.contains('pigment') || id.contains('spot') || id.contains('تصبغ')) {
      return 'تظهر المناطق التي رصدها تحليل البشرة';
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return 'تظهر مواضع المسام التي رصدها التحليل';
    }
    if (id.contains('wrinkle') || id.contains('تجاعيد')) {
      return 'تظهر خطوط التعبير التي رصدها التحليل';
    }
    if (id.contains('redness') || id.contains('احمرار')) {
      return 'تظهر مناطق الاحمرار المرصودة';
    }
    if (id.contains('texture') || id.contains('ملمس')) {
      return 'تظهر تفاوت الملمس المرصود';
    }
    if (id.contains('acne') || id.contains('حبوب')) {
      return 'تظهر مواضع مظهر الحبوب المرصودة';
    }
    if (id.contains('hydrat') || id.contains('moisture') || id.contains('ترطيب')) {
      return 'يظهر توزيع الترطيب المرصود';
    }
    if (id.contains('oil') || id.contains('دهون')) {
      return 'تظهر مناطق الدهون المرصودة';
    }
    return 'تظهر ما رصده تحليل البشرة على صورتك';
  }

  /// Compact status band for Face Explorer score hero (uiScore 0–100).
  static String faceExplorerStatusAr(double? uiScore) {
    if (uiScore == null) return '';
    final v = uiScore.round().clamp(0, 100);
    if (v >= 70) return 'مستوى جيد';
    if (v >= 40) return 'مستوى متوسط';
    return 'يحتاج اهتمامًا';
  }

  /// True if [text] still contains forbidden technical identifiers.
  static bool containsTechnicalIdentifier(String text) {
    final t = text.toLowerCase();
    const banned = [
      'hd_',
      'dark_circle',
      'glabellar',
      'crowfeet',
      'periocular',
      'nasolabial',
      'marionette',
      'output_mask',
      'whole',
      'provider',
    ];
    for (final b in banned) {
      if (t.contains(b)) return true;
    }
    return false;
  }

  static String severityStatusPublicAr(double severity) {
    if (severity < 22) return 'منخفض';
    if (severity < 35) return 'خفيف';
    if (severity < 50) return 'متوسط';
    return 'مرتفع';
  }
}
