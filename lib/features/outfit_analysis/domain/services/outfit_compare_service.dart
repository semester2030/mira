import '../entities/outfit_compare_snapshot.dart';

abstract final class OutfitCompareService {
  OutfitCompareService._();

  static OutfitCompareVerdict compare(
    OutfitCompareSnapshot left,
    OutfitCompareSnapshot right,
  ) {
    final dimensions = [
      OutfitCompareDimension(
        labelAr: 'التوافق العام',
        leftScore: left.compatibilityScore,
        rightScore: right.compatibilityScore,
      ),
      OutfitCompareDimension(
        labelAr: 'ملاءمة المناسبة',
        leftScore: left.occasionMatchScore,
        rightScore: right.occasionMatchScore,
      ),
      OutfitCompareDimension(
        labelAr: 'انسجام الألوان',
        leftScore: left.colorHarmonyScore,
        rightScore: right.colorHarmonyScore,
      ),
      if (left.hasSkinLink || right.hasSkinLink)
        OutfitCompareDimension(
          labelAr: 'توافق البشرة',
          leftScore: left.skinCompatibilityScore,
          rightScore: right.skinCompatibilityScore,
        ),
    ];

    var leftWins = 0;
    var rightWins = 0;
    for (final d in dimensions) {
      if (d.leftWins) leftWins++;
      if (d.rightWins) rightWins++;
    }

    String? winnerSide;
    String headline;
    String summary;

    if (leftWins > rightWins) {
      winnerSide = 'left';
      headline = 'الإطلالة الأولى أنسب لك';
      summary = _buildSummary(left, right, winner: left);
    } else if (rightWins > leftWins) {
      winnerSide = 'right';
      headline = 'الإطلالة الثانية أنسب لك';
      summary = _buildSummary(left, right, winner: right);
    } else {
      headline = 'الإطلالتان متقاربتان';
      summary =
          'تقريباً متعادلتان — ${left.labelAr} (${left.compatibilityScore}%) '
          'مقابل ${right.labelAr} (${right.compatibilityScore}%). '
          'اختاري حسب المناسبة: ${left.occasion.labelAr} أو ${right.occasion.labelAr}.';
    }

    return OutfitCompareVerdict(
      left: left,
      right: right,
      dimensions: dimensions,
      headlineAr: headline,
      summaryAr: summary,
      winnerSide: winnerSide,
    );
  }

  static String _buildSummary(
    OutfitCompareSnapshot left,
    OutfitCompareSnapshot right, {
    required OutfitCompareSnapshot winner,
  }) {
    final loser = winner.id == left.id ? right : left;
    final scoreGap = winner.compatibilityScore - loser.compatibilityScore;
    final occasionHint = winner.occasion == loser.occasion
        ? 'لنفس نوع المناسبة (${winner.occasion.labelAr})'
        : 'لـ ${winner.occasion.labelAr} مقابل ${loser.occasion.labelAr}';

    final colorHint = winner.dominantColors.isNotEmpty && loser.dominantColors.isNotEmpty
        ? ' ألوان ${winner.dominantColors.take(2).join(' و')} تتفوق على ${loser.dominantColors.take(2).join(' و')}.'
        : '';

    return '${winner.labelAr} تتقدّ بـ $scoreGap نقطة ($occasionHint).$colorHint';
  }
}
