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
    final id = concernOrMetricId.toLowerCase();
    if (id.contains('moisture') || id.contains('hydrat')) return 'الترطيب';
    if (id.contains('acne')) return 'مظهر الحبوب';
    if (id.contains('redness')) return 'الاحمرار';
    if (id.contains('pigment') || id.contains('spot')) return 'التصبغ';
    if (id.contains('pore')) return 'المسام';
    if (id.contains('wrinkle')) return 'مظهر الخطوط';
    if (id.contains('oil')) return 'الدهون';
    if (id.contains('texture')) return 'الملمس';
    return concernOrMetricId;
  }

  static String severityStatusPublicAr(double severity) {
    if (severity < 22) return 'منخفض';
    if (severity < 35) return 'خفيف';
    if (severity < 50) return 'متوسط';
    return 'مرتفع';
  }
}
