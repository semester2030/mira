import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../outfit_analysis/domain/entities/outfit_report.dart';
import '../../../outfit_analysis/domain/services/local_style_report_builder.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/mira_style_report.dart';
import '../../domain/services/local_style_fusion_builder.dart';

MiraStyleReport resolveStyleReport(OutfitReport report) {
  if (report.miraStyleReport != null) return report.miraStyleReport!;

  return LocalStyleReportBuilder.fromOutfitResult(
    OutfitResultMapper.fromReport(report),
  );
}

StyleFusion? resolveStyleFusion(OutfitReport report, {SkinReport? skin}) {
  if (report.styleFusion != null) return report.styleFusion;
  final resolvedSkin = skin ?? report.linkedSkin;
  if (resolvedSkin == null) return null;
  return LocalStyleFusionBuilder.fromSkinAndOutfit(resolvedSkin, report);
}

int displayOutfitScore(OutfitReport report) {
  return report.miraStyleReport?.outfitScore ?? report.compatibilityScore.round();
}
