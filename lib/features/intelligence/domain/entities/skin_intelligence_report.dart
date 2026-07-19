/// Phase 3 — provider-independent skin intelligence (client DTO, no provider JSON).
class SkinIntelligenceReport {
  final String analysisId;
  final String provider;
  final String? providerVersion;
  final String formulaVersion;
  final String captureVersion;
  final String qualityVersion;
  final String skinVersion;
  final String intelligenceVersion;
  final String reportVersion;
  final String generatedAt;
  final int confidence;
  final List<String> limitations;
  final String language;
  final String executiveSummaryAr;
  final String executiveSummaryEn;
  final List<SkinIntelFinding> positiveFindings;
  final List<SkinIntelFinding> priorityFindings;
  final List<SkinIntelMetricRow> metrics;
  final SkinIntelSvi svi;
  final List<SkinIntelRecommendation> recommendations;
  final SkinIntelProgress progress;
  final String retakeGuidanceAr;
  final String retakeGuidanceEn;

  const SkinIntelligenceReport({
    required this.analysisId,
    required this.provider,
    this.providerVersion,
    required this.formulaVersion,
    required this.captureVersion,
    required this.qualityVersion,
    required this.skinVersion,
    required this.intelligenceVersion,
    required this.reportVersion,
    required this.generatedAt,
    required this.confidence,
    required this.limitations,
    required this.language,
    required this.executiveSummaryAr,
    required this.executiveSummaryEn,
    required this.positiveFindings,
    required this.priorityFindings,
    required this.metrics,
    required this.svi,
    required this.recommendations,
    required this.progress,
    required this.retakeGuidanceAr,
    required this.retakeGuidanceEn,
  });

  static SkinIntelligenceReport? tryParse(dynamic raw) {
    if (raw is! Map<String, dynamic>) return null;
    return SkinIntelligenceReport(
      analysisId: raw['analysisId'] as String? ?? '',
      provider: raw['provider'] as String? ?? 'unknown',
      providerVersion: raw['providerVersion'] as String?,
      formulaVersion: raw['formulaVersion'] as String? ?? '',
      captureVersion: raw['captureVersion'] as String? ?? '',
      qualityVersion: raw['qualityVersion'] as String? ?? '',
      skinVersion: raw['skinVersion'] as String? ?? '',
      intelligenceVersion: raw['intelligenceVersion'] as String? ?? '',
      reportVersion: raw['reportVersion'] as String? ?? '',
      generatedAt: raw['generatedAt'] as String? ?? '',
      confidence: (raw['confidence'] as num?)?.toInt() ?? 0,
      limitations: _strList(raw['limitations']),
      language: raw['language'] as String? ?? 'ar+en',
      executiveSummaryAr: raw['executiveSummaryAr'] as String? ?? '',
      executiveSummaryEn: raw['executiveSummaryEn'] as String? ?? '',
      positiveFindings: _findings(raw['positiveFindings']),
      priorityFindings: _findings(raw['priorityFindings']),
      metrics: _metrics(raw['metrics']),
      svi: SkinIntelSvi.fromJson(raw['svi'] as Map<String, dynamic>? ?? {}),
      recommendations: _recs(raw['recommendations']),
      progress: SkinIntelProgress.fromJson(
        raw['progress'] as Map<String, dynamic>? ?? {},
      ),
      retakeGuidanceAr: raw['retakeGuidanceAr'] as String? ?? '',
      retakeGuidanceEn: raw['retakeGuidanceEn'] as String? ?? '',
    );
  }

  static List<String> _strList(dynamic v) =>
      (v as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

  static List<SkinIntelFinding> _findings(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return SkinIntelFinding(
        id: m['id'] as String? ?? '',
        metricId: m['metricId'] as String? ?? '',
        titleAr: m['titleAr'] as String? ?? '',
        titleEn: m['titleEn'] as String? ?? '',
        severity: m['severity'] as String? ?? 'none',
        confidence: m['confidence'] as String? ?? 'unavailable',
        evidenceAr: m['evidenceAr'] as String? ?? '',
        evidenceEn: m['evidenceEn'] as String? ?? '',
      );
    }).toList();
  }

  static List<SkinIntelMetricRow> _metrics(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      final expl = m['explanation'] as Map<String, dynamic>? ?? {};
      return SkinIntelMetricRow(
        id: m['id'] as String? ?? '',
        displayNameAr: m['displayNameAr'] as String? ?? '',
        displayNameEn: m['displayNameEn'] as String? ?? '',
        availability: m['availability'] as String? ?? 'unavailable',
        normalizedValue: (m['normalizedValue'] as num?)?.toDouble(),
        confidence: (m['confidence'] as num?)?.toInt() ?? 0,
        source: m['source'] as String? ?? 'unavailable',
        levelAr: expl['levelAr'] as String? ?? '',
        levelEn: expl['levelEn'] as String? ?? '',
        reasonAr: expl['reasonAr'] as String? ?? '',
        reasonEn: expl['reasonEn'] as String? ?? '',
        limitationsAr: expl['limitationsAr'] as String? ?? '',
        limitationsEn: expl['limitationsEn'] as String? ?? '',
      );
    }).toList();
  }

  static List<SkinIntelRecommendation> _recs(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return SkinIntelRecommendation(
        id: m['id'] as String? ?? '',
        category: m['category'] as String? ?? 'educational',
        titleAr: m['titleAr'] as String? ?? '',
        titleEn: m['titleEn'] as String? ?? '',
        bodyAr: m['bodyAr'] as String? ?? '',
        bodyEn: m['bodyEn'] as String? ?? '',
        reasonAr: m['reasonAr'] as String? ?? '',
        reasonEn: m['reasonEn'] as String? ?? '',
        confidence: (m['confidence'] as num?)?.toInt() ?? 0,
        priority: (m['priority'] as num?)?.toInt() ?? 99,
      );
    }).toList();
  }
}

class SkinIntelFinding {
  final String id;
  final String metricId;
  final String titleAr;
  final String titleEn;
  final String severity;
  final String confidence;
  final String evidenceAr;
  final String evidenceEn;

  const SkinIntelFinding({
    required this.id,
    required this.metricId,
    required this.titleAr,
    required this.titleEn,
    required this.severity,
    required this.confidence,
    required this.evidenceAr,
    required this.evidenceEn,
  });
}

class SkinIntelMetricRow {
  final String id;
  final String displayNameAr;
  final String displayNameEn;
  final String availability;
  final double? normalizedValue;
  final int confidence;
  final String source;
  final String levelAr;
  final String levelEn;
  final String reasonAr;
  final String reasonEn;
  final String limitationsAr;
  final String limitationsEn;

  const SkinIntelMetricRow({
    required this.id,
    required this.displayNameAr,
    required this.displayNameEn,
    required this.availability,
    this.normalizedValue,
    required this.confidence,
    required this.source,
    required this.levelAr,
    required this.levelEn,
    required this.reasonAr,
    required this.reasonEn,
    required this.limitationsAr,
    required this.limitationsEn,
  });

  bool get isAvailable => availability == 'available';
}

class SkinIntelSvi {
  final int score;
  final int confidence;
  final String version;
  final String formulaId;
  final String explanationAr;
  final String explanationEn;

  const SkinIntelSvi({
    required this.score,
    required this.confidence,
    required this.version,
    required this.formulaId,
    required this.explanationAr,
    required this.explanationEn,
  });

  factory SkinIntelSvi.fromJson(Map<String, dynamic> m) => SkinIntelSvi(
        score: (m['score'] as num?)?.toInt() ?? 0,
        confidence: (m['confidence'] as num?)?.toInt() ?? 0,
        version: m['version'] as String? ?? '',
        formulaId: m['formulaId'] as String? ?? '',
        explanationAr: m['explanationAr'] as String? ?? '',
        explanationEn: m['explanationEn'] as String? ?? '',
      );
}

class SkinIntelRecommendation {
  final String id;
  final String category;
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
  final String reasonAr;
  final String reasonEn;
  final int confidence;
  final int priority;

  const SkinIntelRecommendation({
    required this.id,
    required this.category,
    required this.titleAr,
    required this.titleEn,
    required this.bodyAr,
    required this.bodyEn,
    required this.reasonAr,
    required this.reasonEn,
    required this.confidence,
    required this.priority,
  });
}

class SkinIntelProgress {
  final bool comparable;
  final String? unavailableReasonAr;
  final String? unavailableReasonEn;
  final String overallTrend;
  final int? previousSvi;
  final int? currentSvi;
  final double? sviDelta;

  const SkinIntelProgress({
    required this.comparable,
    this.unavailableReasonAr,
    this.unavailableReasonEn,
    required this.overallTrend,
    this.previousSvi,
    this.currentSvi,
    this.sviDelta,
  });

  factory SkinIntelProgress.fromJson(Map<String, dynamic> m) => SkinIntelProgress(
        comparable: m['comparable'] as bool? ?? false,
        unavailableReasonAr: m['unavailableReasonAr'] as String?,
        unavailableReasonEn: m['unavailableReasonEn'] as String?,
        overallTrend: m['overallTrend'] as String? ?? 'unknown',
        previousSvi: (m['previousSvi'] as num?)?.toInt(),
        currentSvi: (m['currentSvi'] as num?)?.toInt(),
        sviDelta: (m['sviDelta'] as num?)?.toDouble(),
      );
}
