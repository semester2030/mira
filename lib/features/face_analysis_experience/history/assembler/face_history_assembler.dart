import '../../../intelligence/domain/entities/face_intelligence_report.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';

/// Pure Face history list assembler — reuses SkinAnalysis history rows.
class FaceHistoryAssembler {
  const FaceHistoryAssembler();

  FaceHistorySurfaceVm build({
    required List<SkinReport> reports,
    String? currentReportId,
  }) {
    final deduped = _dedupe(reports);
    final sorted = [...deduped]..sort(_compareNewestFirst);
    final entries = <FaceHistoryEntryVm>[];
    for (final r in sorted) {
      final e = entryFromReport(r);
      if (e != null) entries.add(e);
    }

    if (entries.isEmpty) {
      return const FaceHistorySurfaceVm(
        entries: [],
        empty: true,
        firstAnalysisOnly: false,
        headlineAr: FaceHistoryCopy.emptyHeadline,
        supportAr: FaceHistoryCopy.emptySupport,
        comparisonAvailable: false,
      );
    }

    final firstOnly = entries.length == 1;
    final comparablePairs = _hasComparablePair(entries);
    return FaceHistorySurfaceVm(
      entries: entries,
      empty: false,
      firstAnalysisOnly: firstOnly,
      headlineAr: firstOnly
          ? FaceHistoryCopy.firstAnalysisHeadline
          : FaceHistoryCopy.entryTitle,
      supportAr: firstOnly
          ? FaceHistoryCopy.firstAnalysisSupport
          : FaceHistoryCopy.entrySubtitle,
      currentEntryId: currentReportId == null
          ? null
          : entries
              .where((e) => e.reportId == currentReportId)
              .map((e) => e.entryId)
              .cast<String?>()
              .firstWhere((_) => true, orElse: () => null),
      comparisonAvailable: comparablePairs,
    );
  }

  FaceHistoryEntryVm? entryFromReport(SkinReport report) {
    final mira = miraReportFrom(report);
    final face = mira?.faceIntelligence;
    final id = report.id ?? face?.analysisId;
    if (id == null || id.isEmpty) return null;

    if (face == null) {
      return FaceHistoryEntryVm(
        entryId: 'hist_$id',
        reportId: report.id,
        analysisId: id,
        capturedAt: report.createdAt,
        primaryLabelAr: FaceHistoryCopy.noFaceIntel,
        qualityLabelAr: FaceHistoryCopy.qualityUnavailable,
        reportVersion: '',
        shapeVersion: '',
        intelligenceVersion: '',
        confidence: 0,
        selfGate: FaceComparabilityGate.notComparable,
        hasFaceIntelligence: false,
      );
    }

    final eligible = face.measurementEligible &&
        face.shape.availability == 'available' &&
        (face.shape.displayNameAr?.isNotEmpty ?? false);
    final gate = !eligible
        ? FaceComparabilityGate.notComparable
        : face.confidence < 50
            ? FaceComparabilityGate.comparableWithQualification
            : FaceComparabilityGate.comparable;

    return FaceHistoryEntryVm(
      entryId: 'hist_$id',
      reportId: report.id,
      analysisId: face.analysisId.isNotEmpty ? face.analysisId : id,
      capturedAt: report.createdAt ??
          DateTime.tryParse(face.generatedAt),
      primaryLabelAr: face.shape.displayNameAr?.isNotEmpty == true
          ? 'شكل الوجه: ${face.shape.displayNameAr}'
          : (face.executiveSummaryAr.isNotEmpty
              ? face.executiveSummaryAr
              : FaceHistoryCopy.noFaceIntel),
      shapeId: face.shape.shapeId,
      measurementEligible: face.measurementEligible,
      hasFaceIntelligence: true,
      qualityLabelAr: _qualityLabel(face, gate),
      reportVersion: face.reportVersion,
      shapeVersion: face.shapeVersion,
      intelligenceVersion: face.intelligenceVersion,
      confidence: face.confidence,
      selfGate: gate,
    );
  }

  String _qualityLabel(FaceIntelligenceReport face, FaceComparabilityGate gate) {
    if (!face.measurementEligible) return FaceHistoryCopy.qualityRetake;
    switch (gate) {
      case FaceComparabilityGate.comparable:
        return FaceHistoryCopy.qualityEligible;
      case FaceComparabilityGate.comparableWithQualification:
        return FaceHistoryCopy.qualityLimited;
      case FaceComparabilityGate.notComparable:
        return FaceHistoryCopy.qualityUnavailable;
    }
  }

  bool _hasComparablePair(List<FaceHistoryEntryVm> entries) {
    final ok = entries
        .where((e) => e.selfGate != FaceComparabilityGate.notComparable)
        .toList();
    if (ok.length < 2) return false;
    for (var i = 0; i < ok.length; i++) {
      for (var j = i + 1; j < ok.length; j++) {
        if (_versionsCompatible(ok[i], ok[j])) return true;
      }
    }
    return false;
  }

  static bool _versionsCompatible(FaceHistoryEntryVm a, FaceHistoryEntryVm b) {
    if (a.reportVersion.isEmpty || b.reportVersion.isEmpty) return false;
    return a.reportVersion == b.reportVersion &&
        a.shapeVersion == b.shapeVersion;
  }

  List<SkinReport> _dedupe(List<SkinReport> reports) {
    final seen = <String>{};
    final out = <SkinReport>[];
    for (final r in reports) {
      final key = r.id ?? '';
      if (key.isEmpty) {
        out.add(r);
        continue;
      }
      if (seen.add(key)) out.add(r);
    }
    return out;
  }

  int _compareNewestFirst(SkinReport a, SkinReport b) {
    final at = a.createdAt;
    final bt = b.createdAt;
    if (at == null && bt == null) {
      return (b.id ?? '').compareTo(a.id ?? '');
    }
    if (at == null) return 1;
    if (bt == null) return -1;
    final c = bt.compareTo(at);
    if (c != 0) return c;
    return (b.id ?? '').compareTo(a.id ?? '');
  }
}
