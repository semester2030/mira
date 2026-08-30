import '../../../intelligence/domain/entities/face_intelligence_report.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';
import '../validators/face_history_validators.dart';
import 'face_history_assembler.dart';

/// Pure comparison assembler — fail-closed, never gamifies structural traits.
class FaceComparisonAssembler {
  const FaceComparisonAssembler();

  /// Baseline = previous comparable analysis (not oldest / not "best face").
  FaceHistoryEntryVm? selectBaseline({
    required List<FaceHistoryEntryVm> entriesNewestFirst,
    required FaceHistoryEntryVm current,
  }) {
    for (final e in entriesNewestFirst) {
      if (e.entryId == current.entryId) continue;
      if (e.reportId != null &&
          current.reportId != null &&
          e.reportId == current.reportId) {
        continue;
      }
      if (e.selfGate == FaceComparabilityGate.notComparable) continue;
      if (!_versionsCompatible(current, e)) continue;
      // Prefer eligible over low-quality previous.
      if (!e.measurementEligible) continue;
      return e;
    }
    // Fallback: qualified previous with matching version.
    for (final e in entriesNewestFirst) {
      if (e.entryId == current.entryId) continue;
      if (e.selfGate == FaceComparabilityGate.notComparable) continue;
      if (!_versionsCompatible(current, e)) continue;
      return e;
    }
    return null;
  }

  FaceComparisonVm build({
    required SkinReport currentReport,
    required SkinReport previousReport,
  }) {
    const hist = FaceHistoryAssembler();
    final current = hist.entryFromReport(currentReport);
    final previous = hist.entryFromReport(previousReport);

    if (current == null || previous == null) {
      return _blocked(
        currentRef: currentReport.id ?? 'unknown',
        previousRef: previousReport.id ?? 'unknown',
        reason: FaceHistoryCopy.incompatibleSupport,
      );
    }

    final gate = _gate(current, previous);
    if (gate == FaceComparabilityGate.notComparable) {
      final vm = FaceComparisonVm(
        comparisonId: 'cmp_${current.analysisId}_${previous.analysisId}',
        currentAnalysisRef: current.analysisId,
        previousAnalysisRef: previous.analysisId,
        gate: gate,
        comparisonReasonAr: FaceHistoryCopy.incompatibleHeadline,
        comparableItems: const [],
        historicalOnlyItems: _historicalOnly(current, previous),
        limitationsAr: const [FaceHistoryCopy.incompatibleSupport],
        currentCapturedAt: current.capturedAt,
        previousCapturedAt: previous.capturedAt,
      );
      FaceHistoryValidators.assertMayRender(vm);
      return vm;
    }

    final curFace = miraReportFrom(currentReport)?.faceIntelligence;
    final prevFace = miraReportFrom(previousReport)?.faceIntelligence;
    final items = <FaceComparisonItemVm>[];
    if (curFace != null && prevFace != null) {
      items.addAll(_shapeItem(curFace, prevFace));
      items.addAll(_findingItems(curFace, prevFace));
    }

    final vm = FaceComparisonVm(
      comparisonId: 'cmp_${current.analysisId}_${previous.analysisId}',
      currentAnalysisRef: current.analysisId,
      previousAnalysisRef: previous.analysisId,
      gate: gate,
      comparisonReasonAr: gate == FaceComparabilityGate.comparableWithQualification
          ? FaceHistoryCopy.qualifiedHeadline
          : FaceHistoryCopy.comparisonTitle,
      comparableItems: items,
      historicalOnlyItems: const [],
      limitationsAr: [
        if (gate == FaceComparabilityGate.comparableWithQualification)
          FaceHistoryCopy.differs,
        FaceHistoryCopy.shapeDiffNote,
      ],
      currentCapturedAt: current.capturedAt,
      previousCapturedAt: previous.capturedAt,
    );
    FaceHistoryValidators.assertMayRender(vm);
    FaceHistoryValidators.assertNoProgressLanguage(vm);
    for (final i in vm.comparableItems) {
      FaceHistoryValidators.assertStructuralNeverImproved(i);
    }
    return vm;
  }

  FaceComparabilityGate _gate(
    FaceHistoryEntryVm current,
    FaceHistoryEntryVm previous,
  ) {
    if (!current.hasFaceIntelligence || !previous.hasFaceIntelligence) {
      return FaceComparabilityGate.notComparable;
    }
    if (!_versionsCompatible(current, previous)) {
      return FaceComparabilityGate.notComparable;
    }
    if (!current.measurementEligible || !previous.measurementEligible) {
      return FaceComparabilityGate.notComparable;
    }
    if (current.selfGate == FaceComparabilityGate.notComparable ||
        previous.selfGate == FaceComparabilityGate.notComparable) {
      return FaceComparabilityGate.notComparable;
    }
    if (current.selfGate == FaceComparabilityGate.comparableWithQualification ||
        previous.selfGate ==
            FaceComparabilityGate.comparableWithQualification) {
      return FaceComparabilityGate.comparableWithQualification;
    }
    return FaceComparabilityGate.comparable;
  }

  List<FaceComparisonItemVm> _shapeItem(
    FaceIntelligenceReport cur,
    FaceIntelligenceReport prev,
  ) {
    final c = cur.shape.displayNameAr ?? '—';
    final p = prev.shape.displayNameAr ?? '—';
    final same = cur.shape.shapeId != null &&
        cur.shape.shapeId == prev.shape.shapeId;
    final rel = (c == '—' || p == '—')
        ? FaceComparisonRelationship.unavailable
        : same
            ? FaceComparisonRelationship.similar
            : FaceComparisonRelationship.differs;
    return [
      FaceComparisonItemVm(
        itemId: 'shape',
        labelAr: 'شكل الوجه',
        comparabilityClass: FaceComparabilityClass.structural,
        currentPresentationAr: c,
        previousPresentationAr: p,
        relationship: rel,
        userLanguageAr: switch (rel) {
          FaceComparisonRelationship.similar => FaceHistoryCopy.similar,
          FaceComparisonRelationship.differs => FaceHistoryCopy.shapeDiffNote,
          _ => FaceHistoryCopy.unavailable,
        },
        qualificationAr: FaceHistoryCopy.shapeDiffNote,
      ),
    ];
  }

  List<FaceComparisonItemVm> _findingItems(
    FaceIntelligenceReport cur,
    FaceIntelligenceReport prev,
  ) {
    final out = <FaceComparisonItemVm>[];
    final prevById = {
      for (final f in [...prev.notableFindings, ...prev.findings]) f.id: f,
    };
    final seen = <String>{};
    for (final f in [...cur.notableFindings, ...cur.findings].take(3)) {
      if (!seen.add(f.id)) continue;
      final pf = prevById[f.id];
      final isSym = f.category == 'symmetry_note';
      final cls = isSym
          ? FaceComparabilityClass.contextual
          : FaceComparabilityClass.structural;
      if (pf == null) {
        out.add(
          FaceComparisonItemVm(
            itemId: f.id,
            labelAr: f.titleAr,
            comparabilityClass: cls,
            currentPresentationAr: f.detailAr,
            previousPresentationAr: '—',
            relationship: FaceComparisonRelationship.unavailable,
            userLanguageAr: FaceHistoryCopy.unavailable,
          ),
        );
        continue;
      }
      final same = f.detailAr.trim() == pf.detailAr.trim();
      out.add(
        FaceComparisonItemVm(
          itemId: f.id,
          labelAr: f.titleAr,
          comparabilityClass: cls,
          currentPresentationAr: f.detailAr,
          previousPresentationAr: pf.detailAr,
          relationship: same
              ? FaceComparisonRelationship.similar
              : FaceComparisonRelationship.differs,
          userLanguageAr: same
              ? FaceHistoryCopy.similar
              : (isSym
                  ? FaceHistoryCopy.symmetryDiffNote
                  : FaceHistoryCopy.differs),
          qualificationAr: isSym ? FaceHistoryCopy.symmetryDiffNote : null,
        ),
      );
    }
    return out;
  }

  List<FaceComparisonItemVm> _historicalOnly(
    FaceHistoryEntryVm current,
    FaceHistoryEntryVm previous,
  ) {
    return [
      FaceComparisonItemVm(
        itemId: 'hist_current',
        labelAr: 'التحليل الحالي',
        comparabilityClass: FaceComparabilityClass.notComparable,
        currentPresentationAr: current.primaryLabelAr,
        previousPresentationAr: previous.primaryLabelAr,
        relationship: FaceComparisonRelationship.notCompared,
        userLanguageAr: FaceHistoryCopy.incompatibleSupport,
      ),
    ];
  }

  FaceComparisonVm _blocked({
    required String currentRef,
    required String previousRef,
    required String reason,
  }) {
    final vm = FaceComparisonVm(
      comparisonId: 'cmp_blocked_${currentRef}_$previousRef',
      currentAnalysisRef: currentRef,
      previousAnalysisRef: previousRef,
      gate: FaceComparabilityGate.notComparable,
      comparisonReasonAr: FaceHistoryCopy.incompatibleHeadline,
      comparableItems: const [],
      historicalOnlyItems: const [],
      limitationsAr: [reason],
    );
    FaceHistoryValidators.assertMayRender(vm);
    return vm;
  }

  static bool _versionsCompatible(FaceHistoryEntryVm a, FaceHistoryEntryVm b) {
    if (a.reportVersion.isEmpty || b.reportVersion.isEmpty) return false;
    return a.reportVersion == b.reportVersion &&
        a.shapeVersion == b.shapeVersion;
  }
}
