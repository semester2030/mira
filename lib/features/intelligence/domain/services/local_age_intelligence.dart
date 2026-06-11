import '../../domain/entities/age_comparison.dart';
import '../../domain/entities/mira_beauty_report.dart';

/// Phase 3 — local age intelligence + child safety (mirrors backend engines).
abstract final class LocalAgeIntelligence {
  LocalAgeIntelligence._();

  static const childAgeThreshold = 16;
  static const maxRealisticSkinAge = 80;

  static int? computeUserAge(int? birthYear) {
    if (birthYear == null) return null;
    final year = birthYear;
    final currentYear = DateTime.now().year;
    if (year < 1920 || year > currentYear) return null;
    return currentYear - year;
  }

  static ChildSafety applyChildSafety({
    int? birthYear,
    int? skinAge,
  }) {
    final userAge = computeUserAge(birthYear);
    final isMinor = userAge != null && userAge < childAgeThreshold;
    final restrictions = <String>[];
    String? messageAr;
    int? sanitizedSkinAge = skinAge;

    if (isMinor) {
      restrictions.addAll(['no_wrinkle_diagnosis', 'no_skin_age_delta']);
      messageAr =
          'تحليل البشرة للمراهقات يركز على العناية اللطيفة — بدون تشخيص تجاعيد أو مقارنة عمر.';
      sanitizedSkinAge = null;
    }

    if (sanitizedSkinAge != null && sanitizedSkinAge > maxRealisticSkinAge) {
      restrictions.add('unrealistic_skin_age_suppressed');
      sanitizedSkinAge = null;
      messageAr ??=
          'تقدير عمر البشرة غير موثوق في هذه الصورة — ركزنا على ملاحظات عامة آمنة.';
    }

    return ChildSafety(
      isMinor: isMinor,
      ageThreshold: childAgeThreshold,
      restrictionsApplied: restrictions,
      messageAr: messageAr,
    );
  }

  static List<ConcernNarrative> filterConcerns(
    List<ConcernNarrative> concerns,
    ChildSafety safety,
  ) {
    if (!safety.isMinor) return concerns;
    return concerns.where((c) => c.id != 'wrinkle').toList();
  }

  static AgeComparison buildComparison({
    int? birthYear,
    int? skinAge,
    required ChildSafety safety,
    List<String> concernIds = const [],
    bool isGuest = false,
  }) {
    if (isGuest) {
      return AgeComparison(
        enabled: false,
        headlineAr: 'مقارنة العمر للمسجّلات',
        summaryAr: 'سجّلي دخولك وأضيفي سنة ميلادك لمقارنة عمرك مع عمر بشرتك.',
        causesAr: const [],
        opportunitiesAr: const [],
        insights: const [],
        suppressedReason: 'guest',
      );
    }

    if (safety.isMinor) {
      return AgeComparison(
        enabled: false,
        headlineAr: 'مقارنة العمر غير متاحة',
        summaryAr: safety.messageAr ??
            'نركز على عناية لطيفة ومناسبة للمراهقات.',
        causesAr: const [],
        opportunitiesAr: const [],
        insights: const [],
        suppressedReason: 'minor_user',
      );
    }

    final userAge = computeUserAge(birthYear);
    if (userAge == null) {
      return AgeComparison(
        enabled: false,
        headlineAr: 'أضيفي سنة ميلادك',
        summaryAr:
            'حدّدي سنة ميلادك في الملف الشخصي لمقارنة عمرك مع عمر بشرتك التقديري.',
        causesAr: const [],
        opportunitiesAr: const [],
        insights: const [],
        suppressedReason: 'missing_birth_year',
      );
    }

    final effectiveSkinAge = skinAge;
    if (effectiveSkinAge == null ||
        effectiveSkinAge > maxRealisticSkinAge) {
      return AgeComparison(
        enabled: false,
        headlineAr: 'تقدير العمر غير متاح',
        summaryAr:
            'لم نتمكن من عرض مقارنة دقيقة — ركزنا على ملاحظات العناية العامة.',
        causesAr: const [],
        opportunitiesAr: const [],
        insights: const [],
        suppressedReason: 'unrealistic_skin_age',
      );
    }

    final delta = effectiveSkinAge - userAge;
    final deltaLabel = delta == 0
        ? '±0 سنة'
        : '${delta > 0 ? '+' : ''}$delta ${delta.abs() == 1 ? 'سنة' : 'سنوات'}';

    final causes = _buildCauses(concernIds);
    final opportunities = _buildOpportunities(delta, concernIds);

    return AgeComparison(
      enabled: true,
      userAge: userAge,
      skinAge: effectiveSkinAge,
      deltaYears: delta,
      headlineAr:
          'عمرك $userAge · بشرتك تبدو $effectiveSkinAge · $deltaLabel',
      summaryAr: delta > 0
          ? 'مؤشر المظهر العمري لبشرتك أعلى من عمرك بحوالي ${delta.abs()} ${delta.abs() == 1 ? 'سنة' : 'سنوات'} — روتين ثابت قد يساعد.'
          : delta < 0
              ? 'العمر الجمالي التقديري لبشرتك أقل من عمرك بحوالي ${delta.abs()} ${delta.abs() == 1 ? 'سنة' : 'سنوات'}.'
              : 'مؤشر المظهر العمري لبشرتك متوافق مع عمرك — توازن جيد.',
      causesAr: causes,
      opportunitiesAr: opportunities,
      insights: [
        AgeComparisonInsight(
          id: 'why',
          titleAr: 'لماذا هذا الفرق؟',
          bodyAr: delta > 0
              ? 'الجمع بين عوامل بيئية (شمس، جفاف) ونمط حياة قد يرفع مظهر عمر البشرة — تقدير وليس تشخيصاً.'
              : delta < 0
                  ? 'مؤشر المظهر العمري أفضل من المتوسط لعُمرك — غالباً بفضل ترطيب وحماية من الشمس.'
                  : 'مؤشر المظهر العمري متوافق مع عمرك — مؤشر على عناية متوازنة.',
        ),
        if (causes.isNotEmpty)
          AgeComparisonInsight(
            id: 'causes',
            titleAr: 'أسباب محتملة',
            bodyAr: causes.join(' '),
          ),
      ],
    );
  }

  static List<String> _buildCauses(List<String> concernIds) {
    const map = {
      'moisture': 'جفاف يسرّع ظهور علامات التعب على البشرة.',
      'age_spot': 'التصبغات وإفراط التعرض للشمس يرفعان مظهر العمر.',
      'wrinkle': 'خطوط دقيقة أو نقص ترطيب يظهران كفرق في العمر.',
    };
    final causes =
        concernIds.map((id) => map[id]).whereType<String>().take(3).toList();
    if (causes.length >= 2) return causes;
    return [
      ...causes,
      'التعرض للشمس بدون واقي يومي.',
      'نقص الترطيب المنتظم.',
    ].take(3).toList();
  }

  static List<String> _buildOpportunities(int delta, List<String> concernIds) {
    if (delta > 0) {
      return [
        'واقي شمس SPF 50 يومياً — أهم خطوة لإبطاء فرق العمر.',
        if (concernIds.contains('moisture'))
          'سيروم ترطيب صباحاً ومساءً لتحسين مظهر البشرة.',
        'نوم كافٍ وشرب ماء — يظهران على نضارة البشرة.',
      ];
    }
    return [
      'حافظي على روتينك الحالي — بشرتك في توازن جيد.',
      'استمرري بواقي الشمس لحماية هذا التقدم.',
    ];
  }
}
