import '../../../intelligence/domain/entities/mira_beauty_report.dart';
import '../entities/advisor_response.dart';

/// Offline advisor — mirrors backend Phase 7a engines (no LLM).
abstract final class LocalAdvisorEngine {
  LocalAdvisorEngine._();

  static const _disclaimer =
      'نصيحة عناية عامة من ميرا — ليست تشخيصاً طبياً ولا وصفة علاجية.';

  static const presetQuestions = [
    'هل أحتاج سيروم؟',
    'هل يناسبني الريتينول؟',
    'كيف أحسّن الهالات؟',
    'كيف أحافظ على النتائج؟',
  ];

  static AdvisorResponse answer(MiraBeautyReport report, String message) {
    if (_isBlocked(message)) {
      return AdvisorResponse(
        answer:
            'ميرا مستشارة عناية — لا نقدّم تشخيصاً طبياً ولا وصف أدوية. '
            'استشيري طبيبة جلدية عند الحاجة.\n\n$_disclaimer',
        suggestedQuestions: presetQuestions.take(3).toList(),
        confidence: 'high',
        intent: 'blocked',
        blocked: true,
      );
    }

    final intent = _detectIntent(message);
    final body = _compose(report, intent, message);
    return AdvisorResponse(
      answer: '$body\n\n$_disclaimer',
      suggestedQuestions: _followUps(intent),
      confidence: intent == 'general' ? 'medium' : 'high',
      intent: intent,
    );
  }

  static bool _isBlocked(String message) {
    final t = message.toLowerCase();
    return t.contains('تشخيص') ||
        t.contains('وصفة') ||
        t.contains('دواء') ||
        t.contains('diagnos') ||
        t.contains('prescription');
  }

  static String _detectIntent(String message) {
    final t = message.toLowerCase();
    if (t.contains('ريتين') || t.contains('retinol')) return 'retinol';
    if (t.contains('سيروم') || t.contains('serum')) return 'serum';
    if (t.contains('هالات') || t.contains('dark')) return 'dark_circles';
    if (t.contains('مسام') || t.contains('pore')) return 'pores';
    if (t.contains('حافظ') || t.contains('النتائج')) return 'maintain';
    if (t.contains('منتج') || t.contains('product')) return 'product';
    if (t.contains('واقي') || t.contains('spf') || t.contains('شمس')) {
      return 'routine';
    }
    return 'general';
  }

  static String _compose(MiraBeautyReport report, String intent, String message) {
    final skin = report.skinTypeAr;
    final concerns =
        report.mainConcerns.map((c) => c.titleAr).take(2).join(' · ');

    switch (intent) {
      case 'serum':
        final product = report.recommendedProducts.isNotEmpty
            ? report.recommendedProducts.first.nameAr
            : null;
        return 'بشرة $skin · $concerns — سيروم ترطيب أو فيتامين C قد يساعد بعد الغسول.'
            '${product != null ? ' منتجك: $product.' : ''}';
      case 'retinol':
        if (report.childSafety.isMinor) {
          return 'ريتينول غير مناسب للقُصّر — ركزي على غسول · مرطب · SPF.';
        }
        return 'ريتينول مساءً تدريجياً إن ظهرت تجاعيد في تقريرك — SPF إلزامي.';
      case 'dark_circles':
        return 'الهالات: تقدير عام — ترطيب · نوم · SPF. ليس تشخيصاً موضعياً على العين.';
      case 'pores':
        return 'المسام: BHA خفيف 1–2× أسبوعياً · تنظيف لطيف · بشرة $skin.';
      case 'maintain':
        return report.progressForecast.enabled
            ? 'استمري على SPF وروتينك — نلاحظ تحسناً في ${report.progressForecast.summaryAr}'
            : 'SPF يومياً · روتين ثابت · تحليل متابعة بعد أسبوعين.';
      case 'product':
        if (report.recommendedProducts.isEmpty) {
          return 'راجعي روتينك اليومي أولاً — المنتجات تظهر مع تحليل محفوظ.';
        }
        final p = report.recommendedProducts.first;
        return '«${p.nameAr}» — تطابق ${p.matchScore}/100 مع $concerns.';
      case 'routine':
        final spfSteps = report.dailyRoutine.morning
            .where((s) => s.nameAr.contains('شمس') || s.nameAr.contains('SPF'))
            .toList();
        final spfName = spfSteps.isNotEmpty ? spfSteps.first.nameAr : null;
        return spfName != null
            ? '«$spfName» يحمي نتائجك من UV — ${report.dailyRoutine.morning.first.stepAr}'
            : 'واقي الشمس خطوة أساسية لبشرة $skin.';
      default:
        return 'بشرتك $skin — $concerns. اسأليني عن سيروم · روتين · أو منتج.';
    }
  }

  static List<String> _followUps(String intent) {
    return presetQuestions.where((q) => !_matchesIntent(q, intent)).take(3).toList();
  }

  static bool _matchesIntent(String q, String intent) {
    return _detectIntent(q) == intent;
  }
}
