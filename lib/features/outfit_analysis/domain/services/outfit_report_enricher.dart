import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../intelligence/domain/services/local_style_fusion_builder.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/outfit_report.dart';
import 'local_style_report_builder.dart';

/// Attaches Mira Style Report (+ optional fusion) to outfit reports.
abstract final class OutfitReportEnricher {
  OutfitReportEnricher._();

  static OutfitReport enrich(
    OutfitReport report, {
    SkinReport? skin,
    int? previousScore,
    /// When true, uses [AnalysisSession.lastSkin] for Smart/fusion (legacy API path).
    bool linkSessionSkin = false,
  }) {
    final result = OutfitResultMapper.fromReport(report);
    final styleReport = report.miraStyleReport ??
        LocalStyleReportBuilder.fromOutfitResult(
          result,
          previousScore: previousScore,
        );

    final linkedSkin = skin ?? (linkSessionSkin ? AnalysisSession.lastSkin : null);
    final fusion = linkedSkin != null
        ? LocalStyleFusionBuilder.fromSkinAndOutfit(linkedSkin, report)
        : report.styleFusion;

    return report.copyWith(
      compatibilityScore: styleReport.outfitScore.toDouble(),
      miraStyleReport: styleReport,
      styleFusion: fusion,
      linkedSkin: linkedSkin,
    );
  }
}
