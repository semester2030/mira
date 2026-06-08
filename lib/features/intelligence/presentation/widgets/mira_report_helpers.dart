import '../../../skin_analysis/data/models/skin_report_model.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../../core/services/app_session.dart';
import '../../domain/entities/mira_beauty_report.dart';
import '../../domain/services/local_mira_report_builder.dart';

MiraBeautyReport? miraReportFrom(SkinReport report) {
  if (report is SkinReportModel) return report.miraReport;
  return null;
}

/// API report when present; otherwise local builder with optional birth year.
MiraBeautyReport resolveMiraReport(
  SkinReport report, {
  int? birthYear,
}) {
  final existing = miraReportFrom(report);
  if (existing != null) return existing;
  return LocalMiraReportBuilder.fromSkinReport(
    report,
    birthYear: birthYear,
    isGuest: AppSession.isGuest,
  );
}

SkinReportModel attachMiraReport(
  SkinReport report, {
  int? birthYear,
}) {
  if (report is SkinReportModel && report.miraReport != null) {
    return report;
  }
  final mira = resolveMiraReport(report, birthYear: birthYear);
  return SkinReportModel.fromEntity(report, miraReport: mira);
}
