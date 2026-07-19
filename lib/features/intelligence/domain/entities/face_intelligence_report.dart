/// Phase 4E — Face Intelligence report DTO (client). Sibling to SkinIntelligenceReport.
/// Never conflate with FaceHealthMap.
class FaceIntelligenceReport {
  final String analysisId;
  final String provider;
  final String formulaVersion;
  final String captureVersion;
  final String faceVersion;
  final String intelligenceVersion;
  final String geometryVersion;
  final String shapeVersion;
  final String recommendationVersion;
  final String reportVersion;
  final String generatedAt;
  final int confidence;
  final List<String> limitations;
  final String language;
  final String executiveSummaryAr;
  final String executiveSummaryEn;
  final bool measurementEligible;
  final List<String> eligibilityReasonCodes;
  final FaceIntelShape shape;
  final List<FaceIntelFinding> findings;
  final List<FaceIntelFinding> notableFindings;
  final List<FaceIntelMetricRow> metrics;
  final List<FaceIntelRecommendation> recommendations;
  final List<FaceIntelFeatureLayer> featureLayers;
  final String retakeGuidanceAr;
  final String retakeGuidanceEn;

  const FaceIntelligenceReport({
    required this.analysisId,
    required this.provider,
    required this.formulaVersion,
    required this.captureVersion,
    required this.faceVersion,
    required this.intelligenceVersion,
    required this.geometryVersion,
    required this.shapeVersion,
    required this.recommendationVersion,
    required this.reportVersion,
    required this.generatedAt,
    required this.confidence,
    required this.limitations,
    required this.language,
    required this.executiveSummaryAr,
    required this.executiveSummaryEn,
    required this.measurementEligible,
    required this.eligibilityReasonCodes,
    required this.shape,
    required this.findings,
    required this.notableFindings,
    required this.metrics,
    required this.recommendations,
    required this.featureLayers,
    required this.retakeGuidanceAr,
    required this.retakeGuidanceEn,
  });

  static FaceIntelligenceReport? tryParse(dynamic raw) {
    if (raw is! Map<String, dynamic>) return null;
    return FaceIntelligenceReport(
      analysisId: raw['analysisId'] as String? ?? '',
      provider: raw['provider'] as String? ?? 'unknown',
      formulaVersion: raw['formulaVersion'] as String? ?? '',
      captureVersion: raw['captureVersion'] as String? ?? '',
      faceVersion: raw['faceVersion'] as String? ?? '',
      intelligenceVersion: raw['intelligenceVersion'] as String? ?? '',
      geometryVersion: raw['geometryVersion'] as String? ?? '',
      shapeVersion: raw['shapeVersion'] as String? ?? '',
      recommendationVersion: raw['recommendationVersion'] as String? ?? '',
      reportVersion: raw['reportVersion'] as String? ?? '',
      generatedAt: raw['generatedAt'] as String? ?? '',
      confidence: (raw['confidence'] as num?)?.toInt() ?? 0,
      limitations: _strList(raw['limitations']),
      language: raw['language'] as String? ?? 'ar+en',
      executiveSummaryAr: raw['executiveSummaryAr'] as String? ?? '',
      executiveSummaryEn: raw['executiveSummaryEn'] as String? ?? '',
      measurementEligible: raw['measurementEligible'] as bool? ?? false,
      eligibilityReasonCodes: _strList(raw['eligibilityReasonCodes']),
      shape: FaceIntelShape.fromJson(
        raw['shape'] as Map<String, dynamic>? ?? const {},
      ),
      findings: _findings(raw['findings']),
      notableFindings: _findings(raw['notableFindings']),
      metrics: _metrics(raw['metrics']),
      recommendations: _recs(raw['recommendations']),
      featureLayers: _layers(raw['featureLayers']),
      retakeGuidanceAr: raw['retakeGuidanceAr'] as String? ?? '',
      retakeGuidanceEn: raw['retakeGuidanceEn'] as String? ?? '',
    );
  }

  static List<String> _strList(dynamic v) =>
      (v as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

  static List<FaceIntelFinding> _findings(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return FaceIntelFinding(
        id: m['id'] as String? ?? '',
        category: m['category'] as String? ?? '',
        titleAr: m['titleAr'] as String? ?? '',
        titleEn: m['titleEn'] as String? ?? '',
        detailAr: m['detailAr'] as String? ?? '',
        detailEn: m['detailEn'] as String? ?? '',
        severity: m['severity'] as String? ?? 'info',
        confidence: m['confidence'] as String? ?? 'unavailable',
      );
    }).toList();
  }

  static List<FaceIntelMetricRow> _metrics(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return FaceIntelMetricRow(
        id: m['id'] as String? ?? '',
        displayNameAr: m['displayNameAr'] as String? ?? '',
        displayNameEn: m['displayNameEn'] as String? ?? '',
        availability: m['availability'] as String? ?? 'unavailable',
        normalizedValue: (m['normalizedValue'] as num?)?.toDouble(),
        categoricalValue: m['categoricalValue'] as String?,
        confidence: (m['confidence'] as num?)?.toInt() ?? 0,
        source: m['source'] as String? ?? '',
      );
    }).toList();
  }

  static List<FaceIntelRecommendation> _recs(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return FaceIntelRecommendation(
        id: m['id'] as String? ?? '',
        category: m['category'] as String? ?? '',
        titleAr: m['titleAr'] as String? ?? '',
        titleEn: m['titleEn'] as String? ?? '',
        bodyAr: m['bodyAr'] as String? ?? '',
        bodyEn: m['bodyEn'] as String? ?? '',
      );
    }).toList();
  }

  static List<FaceIntelFeatureLayer> _layers(dynamic v) {
    return (v as List<dynamic>? ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return FaceIntelFeatureLayer(
        id: m['id'] as String? ?? '',
        kind: m['kind'] as String? ?? '',
        titleAr: m['titleAr'] as String? ?? '',
        titleEn: m['titleEn'] as String? ?? '',
        detailAr: m['detailAr'] as String? ?? '',
        detailEn: m['detailEn'] as String? ?? '',
      );
    }).toList();
  }
}

class FaceIntelShape {
  final String availability;
  final String? shapeId;
  final String? displayNameAr;
  final String? displayNameEn;
  final int confidence;
  final String explanationAr;
  final String explanationEn;

  const FaceIntelShape({
    required this.availability,
    this.shapeId,
    this.displayNameAr,
    this.displayNameEn,
    required this.confidence,
    required this.explanationAr,
    required this.explanationEn,
  });

  bool get isAvailable => availability == 'available';

  factory FaceIntelShape.fromJson(Map<String, dynamic> m) => FaceIntelShape(
        availability: m['availability'] as String? ?? 'unavailable',
        shapeId: m['shapeId'] as String?,
        displayNameAr: m['displayNameAr'] as String?,
        displayNameEn: m['displayNameEn'] as String?,
        confidence: (m['confidence'] as num?)?.toInt() ?? 0,
        explanationAr: m['explanationAr'] as String? ?? '',
        explanationEn: m['explanationEn'] as String? ?? '',
      );
}

class FaceIntelFinding {
  final String id;
  final String category;
  final String titleAr;
  final String titleEn;
  final String detailAr;
  final String detailEn;
  final String severity;
  final String confidence;

  const FaceIntelFinding({
    required this.id,
    required this.category,
    required this.titleAr,
    required this.titleEn,
    required this.detailAr,
    required this.detailEn,
    required this.severity,
    required this.confidence,
  });
}

class FaceIntelMetricRow {
  final String id;
  final String displayNameAr;
  final String displayNameEn;
  final String availability;
  final double? normalizedValue;
  final String? categoricalValue;
  final int confidence;
  final String source;

  const FaceIntelMetricRow({
    required this.id,
    required this.displayNameAr,
    required this.displayNameEn,
    required this.availability,
    this.normalizedValue,
    this.categoricalValue,
    required this.confidence,
    required this.source,
  });

  bool get isAvailable => availability == 'available';
}

class FaceIntelRecommendation {
  final String id;
  final String category;
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;

  const FaceIntelRecommendation({
    required this.id,
    required this.category,
    required this.titleAr,
    required this.titleEn,
    required this.bodyAr,
    required this.bodyEn,
  });
}

class FaceIntelFeatureLayer {
  final String id;
  final String kind;
  final String titleAr;
  final String titleEn;
  final String detailAr;
  final String detailEn;

  const FaceIntelFeatureLayer({
    required this.id,
    required this.kind,
    required this.titleAr,
    required this.titleEn,
    required this.detailAr,
    required this.detailEn,
  });
}
