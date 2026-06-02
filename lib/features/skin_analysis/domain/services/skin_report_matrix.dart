import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../entities/skin_concern_score.dart';
import '../entities/skin_report.dart';
import '../entities/skin_routine_product.dart';

/// Builds matrix scores and daily routine from report fields (no image data).
abstract final class SkinReportMatrix {
  SkinReportMatrix._();

  static List<SkinConcernScore> matrixScores(SkinReport report) {
    if (report.concernScores.isNotEmpty) {
      return SkinConcernCatalog.allIds
          .where((id) => report.concernScores.containsKey(id))
          .map((id) => SkinConcernCatalog.labeled(id, report.concernScores[id]!))
          .toList();
    }
    return _fromLegacyMetrics(report);
  }

  static List<SkinConcernScore> radarScores(SkinReport report) {
    final all = {for (final c in matrixScores(report)) c.id: c};
    return SkinConcernCatalog.radarIds
        .map((id) => all[id] ?? SkinConcernCatalog.labeled(id, 70))
        .toList();
  }

  static int skinAge(SkinReport report) {
    if (report.skinAge != null && report.skinAge! > 0) {
      return report.skinAge!;
    }
    final avg = radarScores(report)
        .map((c) => c.score)
        .fold<int>(0, (a, b) => a + b);
    final health = avg / radarScores(report).length;
    final offset = ((100 - health) / 4).round();
    return (28 + offset).clamp(22, 55);
  }

  static List<SkinRoutineProduct> dailyRoutine(SkinReport report) {
    final scores = {for (final c in matrixScores(report)) c.id: c.score};
    final moisture = scores['moisture'] ?? report.hydration;
    final oiliness = scores['oiliness'] ?? report.oiliness;
    final acne = scores['acne'] ?? _severityToUi(report.acne);
    final redness = scores['redness'] ?? _severityToUi(report.redness);

    final steps = <SkinRoutineProduct>[
      const SkinRoutineProduct(
        id: 'cleanser',
        nameAr: 'غسول لطيف',
        nameEn: 'Gentle Cleanser',
        stepAr: 'صباحًا ومساءً',
        stepEn: 'AM & PM',
        icon: Icons.water_drop_outlined,
        accent: AppColors.info,
      ),
      const SkinRoutineProduct(
        id: 'sunscreen',
        nameAr: 'واقي شمس SPF 50',
        nameEn: 'SPF 50 Sunscreen',
        stepAr: 'كل صباح',
        stepEn: 'Every morning',
        icon: Icons.wb_sunny_outlined,
        accent: AppColors.gold,
      ),
    ];

    if (moisture < 60) {
      steps.add(
        const SkinRoutineProduct(
          id: 'serum',
          nameAr: 'سيروم ترطيب',
          nameEn: 'Hydrating Serum',
          stepAr: 'بعد التنظيف',
          stepEn: 'After cleanse',
          icon: Icons.opacity_outlined,
          accent: AppColors.primary,
        ),
      );
    }

    if (oiliness >= 60) {
      steps.add(
        const SkinRoutineProduct(
          id: 'moisturizer_light',
          nameAr: 'مرطب خفيف oil-free',
          nameEn: 'Light Oil-Free Moisturizer',
          stepAr: 'صباحًا',
          stepEn: 'Morning',
          icon: Icons.spa_outlined,
          accent: AppColors.secondary,
        ),
      );
    } else {
      steps.add(
        const SkinRoutineProduct(
          id: 'moisturizer',
          nameAr: 'مرطب يومي',
          nameEn: 'Daily Moisturizer',
          stepAr: 'صباحًا ومساءً',
          stepEn: 'AM & PM',
          icon: Icons.spa_outlined,
          accent: AppColors.secondary,
        ),
      );
    }

    if (acne < 65) {
      steps.add(
        const SkinRoutineProduct(
          id: 'niacinamide',
          nameAr: 'سيروم نياسيناميد',
          nameEn: 'Niacinamide Serum',
          stepAr: 'مساءً',
          stepEn: 'Evening',
          icon: Icons.healing_outlined,
          accent: AppColors.success,
        ),
      );
    }

    if (redness < 65) {
      steps.add(
        const SkinRoutineProduct(
          id: 'soothing',
          nameAr: 'كريم مهدئ',
          nameEn: 'Soothing Cream',
          stepAr: 'عند الحاجة',
          stepEn: 'As needed',
          icon: Icons.favorite_border_rounded,
          accent: AppColors.accent,
        ),
      );
    }

    return steps.take(5).toList();
  }

  static List<SkinConcernScore> _fromLegacyMetrics(SkinReport report) {
    return [
      SkinConcernCatalog.labeled('moisture', report.hydration),
      SkinConcernCatalog.labeled('oiliness', 100 - report.oiliness.clamp(0, 100)),
      SkinConcernCatalog.labeled('pore', _severityToUi(report.pores)),
      SkinConcernCatalog.labeled('wrinkle', _severityToUi(report.wrinkles)),
      SkinConcernCatalog.labeled('age_spot', _severityToUi(report.spots)),
      SkinConcernCatalog.labeled('acne', _severityToUi(report.acne)),
      SkinConcernCatalog.labeled('redness', _severityToUi(report.redness)),
      SkinConcernCatalog.labeled('texture', _blend(report.hydration, report.pores)),
      SkinConcernCatalog.labeled('dark_circle', _blend(report.hydration, report.wrinkles)),
      SkinConcernCatalog.labeled('radiance', _blend(report.hydration, 100 - report.oiliness)),
      SkinConcernCatalog.labeled('firmness', _blend(100 - report.wrinkles * 20, report.hydration)),
      SkinConcernCatalog.labeled('eye_bag', _blend(report.hydration, report.wrinkles)),
    ];
  }

  static int _severityToUi(int severity0to5) {
    return ((5 - severity0to5.clamp(0, 5)) / 5 * 100).round();
  }

  static int _blend(int a, int b) => ((a + b) / 2).round().clamp(0, 100);
}
