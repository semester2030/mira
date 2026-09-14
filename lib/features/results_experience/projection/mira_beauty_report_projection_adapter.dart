import '../../intelligence/domain/entities/mira_beauty_report.dart';
import '../../intelligence/domain/entities/skin_intelligence_report.dart';
import 'result_projection_input.dart';

/// Read-only adapter: frozen MiraBeautyReport → ResultProjectionInput.
/// Does not modify intelligence; strips internal fields from projection path.
abstract final class MiraBeautyReportProjectionAdapter {
  static ResultProjectionInput fromReport(MiraBeautyReport report) {
    final skin = report.skinIntelligence;
    final priorities = _priorities(report, skin);
    final metrics = _metrics(skin);
    final products = report.recommendedProducts
        .map(
          (p) => FrozenProductInput(
            id: p.id,
            nameAr: p.nameAr,
            brandAr: p.partnerNameAr,
            matchScore: p.matchScore,
            linkedConcernId: report.mainConcerns.isNotEmpty
                ? report.mainConcerns.first.id
                : null,
            linkedConcernAr: report.mainConcerns.isNotEmpty
                ? report.mainConcerns.first.titleAr
                : null,
            stepAr: p.stepAr,
            disclosure: 'partner',
            // Match% alone is insufficient — require reason linkage.
            hasRecommendationReason:
                (p.stepAr?.trim().isNotEmpty ?? false) ||
                    report.mainConcerns.isNotEmpty,
            recommendationReasonAr: p.stepAr?.trim().isNotEmpty == true
                ? 'مرتبط بخطوة: ${p.stepAr}'
                : (report.mainConcerns.isNotEmpty
                    ? 'مرتبط باحتياج: ${report.mainConcerns.first.titleAr}'
                    : null),
          ),
        )
        .toList(growable: false);

    final pf = report.progressForecast;
    final progress = FrozenProgressInput(
      scanCount: pf.scanCount,
      hasBaseline: pf.scanCount >= 2 && !pf.needsMoreScans,
      deltaPoints: pf.trends.isNotEmpty ? pf.trends.first.deltaPoints : null,
      projectedScore30Days: pf.projectedOverallScore30Days,
      // Capture/model compatibility not available on legacy forecast —
      // fail closed to not_comparable unless scanCount>=2 and enabled.
      metricCompatible: pf.enabled,
      modelVersionCompatible: pf.enabled,
      captureQualityCompatible: pf.enabled,
      confidenceAdequate: pf.enabled,
    );

    final advisorClaims = <FrozenAdvisorClaimInput>[
      for (final c in report.mainConcerns.take(3))
        FrozenAdvisorClaimInput(
          id: c.id,
          statementAr: c.titleAr,
          available: c.severity != 'none',
        ),
      if (skin != null)
        for (final f in skin.priorityFindings.take(3))
          FrozenAdvisorClaimInput(
            id: f.id,
            statementAr: f.titleAr,
            available: f.severity != 'none',
          ),
    ];

    final ageItem = report.confidenceLayer.itemFor('age_comparison');

    return ResultProjectionInput(
      analysisId: skin?.analysisId.isNotEmpty == true
          ? skin!.analysisId
          : 'local_${report.overallBeautyScore}',
      vitalityScore: report.skinVitalityIndex,
      skinTypeAr: report.skinTypeAr,
      headlineAr: report.headlineAr,
      summaryAr: report.summaryAdviceAr.isNotEmpty
          ? report.summaryAdviceAr
          : report.headlineAr,
      overallConfidencePercent: skin?.confidence ??
          _spatialToPercent(report.spatialConfidence),
      priorities: priorities,
      metrics: metrics,
      products: products,
      progress: progress,
      advisorClaims: advisorClaims,
      morningStepCount: report.dailyRoutine.morning.length,
      eveningStepCount: report.dailyRoutine.evening.length,
      morningSteps: report.dailyRoutine.morning
          .map(
            (s) => FrozenRoutineStepInput(
              id: s.id,
              nameAr: s.nameAr,
              instructionAr: s.stepAr,
              period: s.period,
            ),
          )
          .toList(growable: false),
      eveningSteps: report.dailyRoutine.evening
          .map(
            (s) => FrozenRoutineStepInput(
              id: s.id,
              nameAr: s.nameAr,
              instructionAr: s.stepAr,
              period: s.period,
            ),
          )
          .toList(growable: false),
      weeklyPlanEnabled: report.weeklyPlan.enabled,
      weeklyHeadlineAr: report.weeklyPlan.headlineAr,
      weeklySummaryAr: report.weeklyPlan.summaryAr,
      skinAgeYears: report.skinAgeEstimate,
      skinAgeConfidenceLevel: ageItem?.level,
      mapEnabled: report.faceHealthMap.enabled || report.faceMapEnabled,
      mapConcernIds: report.mainConcerns.map((c) => c.id).toList(),
      disclaimerAr: report.disclaimerAr,
      retakeGuidanceAr: skin?.retakeGuidanceAr,
      tipsAr: report.tipsAr,
    );
  }

  static List<FrozenPriorityInput> _priorities(
    MiraBeautyReport report,
    SkinIntelligenceReport? skin,
  ) {
    if (skin != null && skin.priorityFindings.isNotEmpty) {
      return skin.priorityFindings
          .map(
            (f) => FrozenPriorityInput(
              id: f.id,
              metricId: f.metricId,
              titleAr: f.titleAr,
              evidenceAr: f.evidenceAr,
              severity: f.severity,
              confidenceLevel: f.confidence,
            ),
          )
          .toList(growable: false);
    }
    return report.mainConcerns
        .map(
          (c) => FrozenPriorityInput(
            id: c.id,
            metricId: c.id,
            titleAr: c.titleAr,
            evidenceAr: c.narrativeAr,
            severity: c.severity,
            confidenceLevel: report.spatialConfidence,
          ),
        )
        .toList(growable: false);
  }

  static List<FrozenMetricInput> _metrics(SkinIntelligenceReport? skin) {
    if (skin == null) return const [];
    return skin.metrics
        .map(
          (m) => FrozenMetricInput(
            id: m.id,
            displayNameAr: m.displayNameAr,
            available: m.isAvailable,
            normalizedWellnessValue: m.normalizedValue != null
                ? (m.normalizedValue! <= 1.0
                    ? m.normalizedValue! * 100
                    : m.normalizedValue)
                : null,
            confidencePercent: m.confidence,
            levelAr: m.levelAr,
            reasonAr: m.reasonAr,
          ),
        )
        .toList(growable: false);
  }

  static int _spatialToPercent(String spatial) {
    switch (spatial.toLowerCase()) {
      case 'high':
        return 80;
      case 'medium':
        return 60;
      case 'low':
        return 35;
      default:
        return 0;
    }
  }
}
