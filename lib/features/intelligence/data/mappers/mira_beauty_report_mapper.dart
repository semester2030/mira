import '../../domain/entities/beauty_journey.dart';
import '../../domain/entities/confidence_layer.dart';
import '../../domain/entities/age_comparison.dart';
import '../../domain/entities/face_health_map.dart';
import '../../domain/entities/concern_zones_section.dart';
import '../../domain/entities/progress_forecast.dart';
import '../../domain/entities/mira_beauty_report.dart';
import '../../domain/entities/result_provenance.dart';
import '../../domain/entities/face_intelligence_report.dart';
import '../../domain/entities/skin_intelligence_report.dart';
import '../../domain/entities/weekly_plan.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../face_intelligence/domain/face_intel_runtime_state.dart';

abstract final class MiraBeautyReportMapper {
  MiraBeautyReportMapper._();

  static MiraBeautyReport fromJson(Map<String, dynamic> json) {
    final concernsRaw = json['mainConcerns'] as List<dynamic>? ?? [];
    final routineRaw = json['dailyRoutine'] as Map<String, dynamic>? ?? {};
    final productsRaw = json['recommendedProducts'] as List<dynamic>? ?? [];
    final faceMap = json['faceMap'] as Map<String, dynamic>?;

    return MiraBeautyReport(
      version: (json['version'] as num?)?.toInt() ?? 1,
      scoreSchemaVersion: (json['scoreSchemaVersion'] as num?)?.toInt() ?? 1,
      spatialConfidence: json['spatialConfidence'] as String? ?? 'none',
      overallBeautyScore: (json['overallBeautyScore'] as num?)?.toInt() ?? 0,
      displayScoreLabelAr: json['displayScoreLabelAr'] as String? ??
          CosmeticCopy.skinVitalityIndexAr,
      displayScoreLabelEn: json['displayScoreLabelEn'] as String? ??
          CosmeticCopy.skinVitalityIndexEn,
      scoreSupportingAr: json['scoreSupportingAr'] as String? ??
          CosmeticCopy.skinVitalitySupportingAr,
      disclaimerAr:
          json['disclaimerAr'] as String? ?? CosmeticCopy.disclaimerAr,
      disclaimerEn:
          json['disclaimerEn'] as String? ?? CosmeticCopy.disclaimerEn,
      provenance: ResultProvenance.tryParse(json['provenance']),
      headlineAr: json['headlineAr'] as String? ?? '',
      skinTypeAr: json['skinTypeAr'] as String? ?? '',
      skinTypeEn: json['skinTypeEn'] as String? ?? '',
      skinAgeEstimate: (json['skinAgeEstimate'] as num?)?.toInt(),
      ageComparison: _parseAgeComparison(json['ageComparison']),
      childSafety: _parseChildSafety(json['childSafety']),
      mainConcerns: concernsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return ConcernNarrative(
          id: map['id'] as String? ?? '',
          titleAr: map['titleAr'] as String? ?? '',
          narrativeAr: map['narrativeAr'] as String? ?? '',
          severity: map['severity'] as String? ?? 'none',
        );
      }).toList(),
      dailyRoutine: DailyRoutinePlan(
        morning: _parseSteps(routineRaw['morning']),
        evening: _parseSteps(routineRaw['evening']),
      ),
      summaryAdviceAr: json['summaryAdviceAr'] as String? ?? '',
      tipsAr: (json['tipsAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      faceMapEnabled: faceMap?['enabled'] as bool? ?? false,
      concernZonesSection: _parseConcernZonesSection(
        json['concernZonesSection'],
        json['concernZonesNarrative'],
      ),
      faceHealthMap: _parseFaceHealthMap(json['faceHealthMap']),
      concernZonesNarrative: (json['concernZonesNarrative'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      recommendedProducts: productsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return RecommendedProductSummary(
          id: map['id'] as String? ?? '',
          nameAr: map['nameAr'] as String? ?? '',
          nameEn: map['nameEn'] as String? ?? '',
          partnerNameAr: map['partnerNameAr'] as String? ?? '',
          priceLabel: map['priceLabel'] as String? ?? '',
          externalUrl: map['externalUrl'] as String? ?? '',
          stepAr: map['stepAr'] as String?,
          matchScore: (map['matchScore'] as num?)?.toInt() ?? 0,
        );
      }).toList(),
      weeklyPlan: _parseWeeklyPlan(json['weeklyPlan']),
      progressForecast: _parseProgressForecast(json['progressForecast']),
      beautyJourney: _parseBeautyJourney(json['beautyJourney'], json),
      confidenceLayer: _parseConfidenceLayer(json['confidenceLayer']),
      skinIntelligence: SkinIntelligenceReport.tryParse(json['skinIntelligence']),
      faceIntelligence: FaceIntelligenceReport.tryParse(json['faceIntelligence']),
      faceIntelligenceRuntime:
          FaceIntelRuntimeState.tryParse(json['faceIntelligenceRuntime']),
    );
  }

  static BeautyJourney _parseBeautyJourney(
    dynamic raw,
    Map<String, dynamic> fallbackRoot,
  ) {
    if (raw is! Map<String, dynamic>) {
      final score = (fallbackRoot['overallBeautyScore'] as num?)?.toInt() ?? 0;
      return BeautyJourney.empty(score);
    }

    final goalRaw = raw['nextGoal'] as Map<String, dynamic>? ?? {};
    final topRaw = raw['topOpportunity'] as Map<String, dynamic>?;
    final prioritiesRaw = raw['priorities'] as List<dynamic>? ?? [];

    JourneyPriority? parsePriority(Map<String, dynamic> map) => JourneyPriority(
          rank: (map['rank'] as num?)?.toInt() ?? 0,
          concernId: map['concernId'] as String? ?? '',
          labelAr: map['labelAr'] as String? ?? '',
          currentScore: (map['currentScore'] as num?)?.toInt() ?? 0,
          expectedGainPoints: (map['expectedGainPoints'] as num?)?.toInt() ?? 0,
          rationaleAr: map['rationaleAr'] as String? ?? '',
        );

    return BeautyJourney(
      enabled: raw['enabled'] as bool? ?? true,
      headlineAr: raw['headlineAr'] as String? ?? '',
      summaryAr: raw['summaryAr'] as String? ?? '',
      currentOverallScore: (raw['currentOverallScore'] as num?)?.toInt() ?? 0,
      nextGoal: JourneyGoal(
        metricId: goalRaw['metricId'] as String? ?? 'overall',
        labelAr: goalRaw['labelAr'] as String? ?? '',
        currentValue: (goalRaw['currentValue'] as num?)?.toInt() ?? 0,
        targetValue: (goalRaw['targetValue'] as num?)?.toInt() ?? 0,
        horizonDays: (goalRaw['horizonDays'] as num?)?.toInt() ?? 30,
        headlineAr: goalRaw['headlineAr'] as String? ?? '',
        summaryAr: goalRaw['summaryAr'] as String? ?? '',
      ),
      topOpportunity: topRaw != null ? parsePriority(topRaw) : null,
      priorities: prioritiesRaw
          .whereType<Map<String, dynamic>>()
          .map((map) => JourneyPriority(
                rank: (map['rank'] as num?)?.toInt() ?? 0,
                concernId: map['concernId'] as String? ?? '',
                labelAr: map['labelAr'] as String? ?? '',
                currentScore: (map['currentScore'] as num?)?.toInt() ?? 0,
                expectedGainPoints:
                    (map['expectedGainPoints'] as num?)?.toInt() ?? 0,
                rationaleAr: map['rationaleAr'] as String? ?? '',
              ))
          .toList(),
      planSummaryAr: raw['planSummaryAr'] as String? ?? '',
      followUpAr: raw['followUpAr'] as String? ?? '',
    );
  }

  static ConfidenceLayer _parseConfidenceLayer(dynamic raw) {
    if (raw is! Map<String, dynamic>) return ConfidenceLayer.empty;

    final itemsRaw = raw['items'] as List<dynamic>? ?? [];
    return ConfidenceLayer(
      enabled: raw['enabled'] as bool? ?? true,
      headlineAr: raw['headlineAr'] as String? ?? '',
      summaryAr: raw['summaryAr'] as String? ?? '',
      items: itemsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return ConfidenceItem(
          id: map['id'] as String? ?? '',
          labelAr: map['labelAr'] as String? ?? '',
          level: map['level'] as String? ?? 'low',
          reasonAr: map['reasonAr'] as String? ?? '',
        );
      }).toList(),
    );
  }

  static AgeComparison _parseAgeComparison(dynamic raw) {
    if (raw is! Map<String, dynamic>) {
      return const AgeComparison(
        enabled: false,
        headlineAr: '',
        summaryAr: '',
        causesAr: [],
        opportunitiesAr: [],
        insights: [],
      );
    }
    final insightsRaw = raw['insights'] as List<dynamic>? ?? [];
    return AgeComparison(
      enabled: raw['enabled'] as bool? ?? false,
      userAge: (raw['userAge'] as num?)?.toInt(),
      skinAge: (raw['skinAge'] as num?)?.toInt(),
      deltaYears: (raw['deltaYears'] as num?)?.toInt(),
      headlineAr: raw['headlineAr'] as String? ?? '',
      summaryAr: raw['summaryAr'] as String? ?? '',
      causesAr: (raw['causesAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      opportunitiesAr: (raw['opportunitiesAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      insights: insightsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return AgeComparisonInsight(
          id: map['id'] as String? ?? '',
          titleAr: map['titleAr'] as String? ?? '',
          bodyAr: map['bodyAr'] as String? ?? '',
        );
      }).toList(),
      suppressedReason: raw['suppressedReason'] as String?,
    );
  }

  static FaceHealthMap _parseFaceHealthMap(dynamic raw) {
    if (raw is! Map<String, dynamic>) return FaceHealthMap.empty;

    final zonesRaw = raw['zones'] as List<dynamic>? ?? [];
    final cardsRaw = raw['insightCards'] as List<dynamic>? ?? [];
    final overlaysRaw = raw['concernOverlays'] as List<dynamic>? ?? [];
    final markersRaw = raw['markers'] as List<dynamic>? ?? [];

    return FaceHealthMap(
      enabled: raw['enabled'] as bool? ?? false,
      confidence: raw['confidence'] as String? ?? 'low',
      confidenceLabelAr: raw['confidenceLabelAr'] as String? ?? '',
      mode: raw['mode'] as String? ?? 'educational',
      titleAr: raw['titleAr'] as String? ?? '',
      subtitleAr: raw['subtitleAr'] as String? ?? '',
      disclaimerAr: raw['disclaimerAr'] as String? ?? '',
      zones: zonesRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return FaceHealthZone(
          id: map['id'] as String? ?? '',
          labelAr: map['labelAr'] as String? ?? '',
          highlight: map['highlight'] as bool? ?? false,
          highlightColor: map['highlightColor'] as String? ?? '#C19EE0',
          concernIds: (map['concernIds'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
          zoneScore: (map['zoneScore'] as num?)?.toInt(),
          educationalNoteAr: map['educationalNoteAr'] as String?,
          source: map['source'] as String? ?? 'educational',
        );
      }).toList(),
      insightCards: cardsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return FaceHealthInsight(
          id: map['id'] as String? ?? '',
          concernId: map['concernId'] as String? ?? '',
          concernLabelAr: map['concernLabelAr'] as String? ?? '',
          zoneIds: (map['zoneIds'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
          zoneLabelAr: map['zoneLabelAr'] as String? ?? '',
          bodyAr: map['bodyAr'] as String? ?? '',
        );
      }).toList(),
      concernOverlays: overlaysRaw.map((item) {
        final map = item as Map<String, dynamic>;
        final zoneScoresRaw = map['zoneScores'] as Map<String, dynamic>? ?? {};
        return FaceHealthConcernOverlay(
          concernId: map['concernId'] as String? ?? '',
          labelAr: map['labelAr'] as String? ?? '',
          labelEn: map['labelEn'] as String? ?? '',
          globalScore: (map['globalScore'] as num?)?.toInt() ?? 0,
          severity: map['severity'] as String? ?? 'mild',
          zoneScores: zoneScoresRaw.map(
            (k, v) => MapEntry(k, (v as num).toInt()),
          ),
          highlightZoneIds: (map['highlightZoneIds'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
          highlightColor: map['highlightColor'] as String? ?? '#C19EE0',
          hasRegionalData: map['hasRegionalData'] as bool? ?? false,
        );
      }).toList(),
      defaultConcernId: raw['defaultConcernId'] as String? ?? '',
      markers: markersRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return FaceHealthSpatialMarker(
          concernId: map['concernId'] as String? ?? '',
          zoneId: map['zoneId'] as String? ?? '',
          x: (map['x'] as num?)?.toDouble() ?? 0,
          y: (map['y'] as num?)?.toDouble() ?? 0,
          severity: (map['severity'] as num?)?.toInt() ?? 1,
        );
      }).toList(),
    );
  }

  static ConcernZonesSection _parseConcernZonesSection(
    dynamic raw,
    dynamic legacyNarratives,
  ) {
    if (raw is Map<String, dynamic>) {
      final zonesRaw = raw['zones'] as List<dynamic>? ?? [];
      return ConcernZonesSection(
        enabled: raw['enabled'] as bool? ?? false,
        mode: raw['mode'] as String? ?? 'narrative_only',
        spatialConfidence: raw['spatialConfidence'] as String? ?? 'none',
        titleAr: raw['titleAr'] as String? ?? '',
        disclaimerAr: raw['disclaimerAr'] as String? ?? '',
        zones: zonesRaw.map((item) {
          final map = item as Map<String, dynamic>;
          return ConcernZoneNarrative(
            id: map['id'] as String? ?? '',
            zoneLabelAr: map['zoneLabelAr'] as String? ?? '',
            narrativeAr: map['narrativeAr'] as String? ?? '',
            concernIds: (map['concernIds'] as List<dynamic>?)
                    ?.map((e) => e.toString())
                    .toList() ??
                const [],
          );
        }).toList(),
      );
    }

    final legacy = (legacyNarratives as List<dynamic>?)
            ?.map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList() ??
        const <String>[];
    if (legacy.isEmpty) return ConcernZonesSection.empty;

    return ConcernZonesSection(
      enabled: true,
      mode: 'narrative_only',
      spatialConfidence: 'none',
      titleAr: 'مناطق الاهتمام (تقدير عام)',
      disclaimerAr: 'تقدير عام — ليس تشخيصاً موضعياً على الوجه.',
      zones: [
        for (var i = 0; i < legacy.length; i++)
          ConcernZoneNarrative(
            id: 'legacy_$i',
            zoneLabelAr: 'ملاحظة عامة',
            narrativeAr: legacy[i],
            concernIds: const [],
          ),
      ],
    );
  }

  static ChildSafety _parseChildSafety(dynamic raw) {
    if (raw is! Map<String, dynamic>) return ChildSafety.none;
    return ChildSafety(
      isMinor: raw['isMinor'] as bool? ?? false,
      ageThreshold: (raw['ageThreshold'] as num?)?.toInt() ?? 16,
      restrictionsApplied: (raw['restrictionsApplied'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      messageAr: raw['messageAr'] as String?,
    );
  }

  static WeeklyPlan _parseWeeklyPlan(dynamic raw) {
    if (raw is! Map<String, dynamic>) return WeeklyPlan.empty;

    final daysRaw = raw['days'] as List<dynamic>? ?? [];
    return WeeklyPlan(
      enabled: raw['enabled'] as bool? ?? false,
      headlineAr: raw['headlineAr'] as String? ?? '',
      summaryAr: raw['summaryAr'] as String? ?? '',
      days: daysRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return WeeklyPlanDay(
          dayIndex: (map['dayIndex'] as num?)?.toInt() ?? 0,
          labelAr: map['labelAr'] as String? ?? '',
          focusAr: map['focusAr'] as String? ?? '',
          stepsAr: (map['stepsAr'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
        );
      }).toList(),
    );
  }

  static ProgressForecast _parseProgressForecast(dynamic raw) {
    return parseProgressForecast(raw);
  }

  static ProgressForecast parseProgressForecast(dynamic raw) {
    if (raw is! Map<String, dynamic>) return ProgressForecast.empty;

    final timelineRaw = raw['timeline'] as List<dynamic>? ?? [];
    final trendsRaw = raw['trends'] as List<dynamic>? ?? [];
    final milestonesRaw = raw['milestones'] as List<dynamic>? ?? [];

    return ProgressForecast(
      enabled: raw['enabled'] as bool? ?? false,
      scanCount: (raw['scanCount'] as num?)?.toInt() ?? 0,
      needsMoreScans: raw['needsMoreScans'] as bool? ?? true,
      headlineAr: raw['headlineAr'] as String? ?? '',
      summaryAr: raw['summaryAr'] as String? ?? '',
      timeline: timelineRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return ProgressTimelinePoint(
          analysisId: map['analysisId'] as String? ?? '',
          createdAt: DateTime.tryParse(map['createdAt'] as String? ?? '') ??
              DateTime.now(),
          overallScore: (map['overallScore'] as num?)?.toInt() ?? 0,
        );
      }).toList(),
      trends: trendsRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return ProgressMetricTrend(
          id: map['id'] as String? ?? '',
          labelAr: map['labelAr'] as String? ?? '',
          previousScore: (map['previousScore'] as num?)?.toInt() ?? 0,
          currentScore: (map['currentScore'] as num?)?.toInt() ?? 0,
          deltaPoints: (map['deltaPoints'] as num?)?.toInt() ?? 0,
          direction: map['direction'] as String? ?? 'stable',
          messageAr: map['messageAr'] as String? ?? '',
        );
      }).toList(),
      milestones: milestonesRaw.map((item) {
        final map = item as Map<String, dynamic>;
        return ProgressMilestone(
          id: map['id'] as String? ?? '',
          titleAr: map['titleAr'] as String? ?? '',
          descriptionAr: map['descriptionAr'] as String? ?? '',
        );
      }).toList(),
      projectedOverallScore30Days:
          (raw['projectedOverallScore30Days'] as num?)?.toInt(),
    );
  }

  static List<RoutineStep> _parseSteps(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((item) {
      final map = item as Map<String, dynamic>;
      return RoutineStep(
        id: map['id'] as String? ?? '',
        nameAr: map['nameAr'] as String? ?? '',
        nameEn: map['nameEn'] as String? ?? '',
        stepAr: map['stepAr'] as String? ?? '',
        period: map['period'] as String? ?? 'both',
      );
    }).toList();
  }

  static SkinReport toSkinReport(
    MiraBeautyReport report, {
    String? id,
    DateTime? createdAt,
  }) {
    return SkinReport(
      id: id,
      skinType: report.skinTypeAr,
      skinTypeEn: report.skinTypeEn,
      score: report.overallBeautyScore.toDouble(),
      hydration: 0,
      oiliness: 0,
      pores: 0,
      wrinkles: 0,
      spots: 0,
      recommendations: report.tipsAr,
      advice: report.summaryAdviceAr,
      createdAt: createdAt,
      skinAge: report.skinAgeEstimate,
      concernScores: const {},
    );
  }
}
