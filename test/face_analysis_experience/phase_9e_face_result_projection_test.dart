import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/projection/projection.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';

FaceIntelligenceReport _report({
  String analysisId = 'fx1',
  bool eligible = true,
  List<String> eligibilityCodes = const [],
  bool shapeAvailable = true,
  String shapeId = 'oval',
  String shapeAr = 'بيضاوي',
  int shapeConfidence = 90,
  int confidence = 90,
  List<FaceIntelMetricRow>? metrics,
  List<FaceIntelFinding> findings = const [],
  List<FaceIntelFinding> notable = const [],
  List<FaceIntelRecommendation> recs = const [],
  List<String> limitations = const [
    'تحليل ملامح تجميلي — ليس تشخيصاً طبياً.',
  ],
  String summaryAr =
      'شكل الوجه الظاهر: بيضاوي. ذكاء ملامح تجميلي — ليس تقييماً للجاذبية.',
}) {
  return FaceIntelligenceReport(
    analysisId: analysisId,
    provider: 'on_device_landmarks',
    formulaVersion: 'face-shape-hybrid-rules-v1',
    captureVersion: 'cq-thresholds-v2.1',
    faceVersion: 'face-model-v1',
    intelligenceVersion: 'face-intel-v1',
    geometryVersion: 'face-geometry-v1',
    shapeVersion: 'face-shape-v1',
    recommendationVersion: 'face-reco-v1',
    reportVersion: 'face-report-v1',
    generatedAt: '2026-08-11T00:00:00.000Z',
    confidence: confidence,
    limitations: limitations,
    language: 'ar+en',
    executiveSummaryAr: summaryAr,
    executiveSummaryEn: 'Oval',
    measurementEligible: eligible,
    eligibilityReasonCodes: eligibilityCodes,
    shape: FaceIntelShape(
      availability: shapeAvailable ? 'available' : 'unavailable',
      shapeId: shapeAvailable ? shapeId : null,
      displayNameAr: shapeAvailable ? shapeAr : null,
      displayNameEn: shapeAvailable ? 'Oval' : null,
      confidence: shapeConfidence,
      explanationAr: 'نسب متوازنة نسبياً.',
      explanationEn: 'Balanced',
    ),
    findings: findings,
    notableFindings: notable,
    metrics: metrics ??
        [
          const FaceIntelMetricRow(
            id: 'facialThirdsBalance',
            displayNameAr: 'توازن أثلاث الوجه',
            displayNameEn: 'Thirds',
            availability: 'available',
            normalizedValue: 72,
            categoricalValue: 'raw=0.12',
            confidence: 78,
            source: 'locally_calculated',
          ),
          const FaceIntelMetricRow(
            id: 'faceWidthHeightRatio',
            displayNameAr: 'نسبة عرض إلى ارتفاع الوجه',
            displayNameEn: 'W/H',
            availability: 'available',
            normalizedValue: 80,
            confidence: 78,
            source: 'locally_calculated',
          ),
          const FaceIntelMetricRow(
            id: 'eyeSpacingRatio',
            displayNameAr: 'نسبة تباعد العينين',
            displayNameEn: 'Eyes',
            availability: 'available',
            normalizedValue: 65,
            confidence: 78,
            source: 'locally_calculated',
          ),
          const FaceIntelMetricRow(
            id: 'symmetryCautious',
            displayNameAr: 'التماثل الظاهر (بحذر)',
            displayNameEn: 'Symmetry',
            availability: 'available',
            normalizedValue: 91,
            categoricalValue: 'raw=0.01',
            confidence: 62,
            source: 'locally_calculated',
          ),
          const FaceIntelMetricRow(
            id: 'faceShape',
            displayNameAr: 'شكل الوجه',
            displayNameEn: 'Shape',
            availability: 'available',
            categoricalValue: 'oval',
            confidence: 90,
            source: 'locally_calculated',
          ),
        ],
    recommendations: recs,
    featureLayers: const [],
    retakeGuidanceAr: 'أعيدي الالتقاط بإضاءة أوضح.',
    retakeGuidanceEn: 'Retake',
  );
}

void main() {
  const projector = FaceResultProjector();

  group('FaceResultProjector', () {
    test('version pin', () {
      final p = projector.project(_report());
      expect(p.projectionVersion, FaceResultProjectionVersions.projection);
    });

    test('complete result: primary + ≤3 insights + one next action', () {
      final p = projector.project(
        _report(
          recs: const [
            FaceIntelRecommendation(
              id: 'rec_hairstyle_oval',
              category: 'hairstyle',
              titleAr: 'تسريحة',
              titleEn: 'Hair',
              bodyAr: 'جرّبي طبقات خفيفة',
              bodyEn: 'Layers',
            ),
          ],
        ),
      );
      expect(p.completeness, FaceResultCompleteness.complete);
      expect(p.executiveSummary.primary, isNotNull);
      expect(p.executiveSummary.primary!.valueLabelAr, 'بيضاوي');
      expect(p.executiveSummary.insights.length, lessThanOrEqualTo(3));
      expect(p.executiveSummary.nextAction.kind, FaceNextActionKind.openGuidance);
      expect(p.mirror.orientation, FaceSubjectOrientation.subjectCanonical);
    });

    test('shape not duplicated as insight when primary owns it', () {
      final p = projector.project(_report());
      final keys = p.executiveSummary.insights.map((i) => i.semanticKey);
      expect(keys.any((k) => k.startsWith('shape:')), isFalse);
    });

    test('deterministic stable ids + order', () {
      final a = projector.project(_report());
      final b = projector.project(_report());
      expect(a.executiveSummary.id, b.executiveSummary.id);
      expect(
        a.executiveSummary.insights.map((i) => i.id).toList(),
        b.executiveSummary.insights.map((i) => i.id).toList(),
      );
    });

    test('empty state when report null', () {
      final p = projector.project(null);
      expect(p.completeness, FaceResultCompleteness.empty);
      expect(p.executiveSummary.primary, isNull);
      expect(p.executiveSummary.insights, isEmpty);
      expect(p.executiveSummary.nextAction.kind, FaceNextActionKind.retake);
      expect(p.mirror.contourAllowed, isFalse);
    });

    test('ineligible → retake / no forced primary', () {
      final p = projector.project(
        _report(
          eligible: false,
          eligibilityCodes: const ['head_turned'],
          shapeConfidence: 40,
        ),
      );
      expect(p.measurementEligible, isFalse);
      expect(p.executiveSummary.nextAction.kind, FaceNextActionKind.retake);
      expect(
        p.limitations.any((l) => l.bodyAr.contains('زاوية')),
        isTrue,
      );
    });

    test('low confidence shape qualifies', () {
      final p = projector.project(
        _report(shapeConfidence: 50, confidence: 50),
      );
      expect(p.executiveSummary.primary, isNotNull);
      expect(
        p.executiveSummary.primary!.eligibility,
        FacePresentationEligibility.displayWithQualification,
      );
      expect(p.executiveSummary.primary!.confidenceQualifierAr, isNotNull);
    });

    test('very low shape confidence hides primary', () {
      final p = projector.project(
        _report(shapeAvailable: true, shapeConfidence: 20),
      );
      expect(p.executiveSummary.primary, isNull);
    });

    test('no shape available → partial/empty coherent', () {
      final p = projector.project(
        _report(shapeAvailable: false, metrics: [
          const FaceIntelMetricRow(
            id: 'facialThirdsBalance',
            displayNameAr: 'توازن أثلاث الوجه',
            displayNameEn: 'Thirds',
            availability: 'available',
            normalizedValue: 70,
            confidence: 78,
            source: 'locally_calculated',
          ),
        ]),
      );
      expect(p.executiveSummary.primary, isNull);
      expect(p.completeness, isNot(FaceResultCompleteness.complete));
    });

    test('numeric policy: symmetry detail-only, thirds relative', () {
      final p = projector.project(_report());
      expect(
        p.numericVisibilityByMetric['symmetryCautious'],
        FaceNumericVisibility.detailOnly,
      );
      expect(
        p.numericVisibilityByMetric['facialThirdsBalance'],
        FaceNumericVisibility.showRelativeLabel,
      );
      // Symmetry not forced onto first-surface insights (detailOnly filtered)
      expect(
        p.executiveSummary.insights.any((i) => i.id.contains('symmetry')),
        isFalse,
      );
    });

    test('symmetry never equals attractiveness in copy', () {
      final p = projector.project(_report());
      final blob = [
        p.executiveSummary.headlineAr,
        p.executiveSummary.supportAr,
        ...p.executiveSummary.insights.map((i) => '${i.titleAr}${i.bodyAr}'),
        ...p.limitations.map((l) => l.bodyAr),
      ].join(' ');
      expect(blob.contains('91%'), isFalse);
      expect(blob.contains('درجة جمال'), isFalse);
      expect(blob.toLowerCase().contains('attractiveness'), isFalse);
    });

    test('forbidden concept validator fires', () {
      expect(
        () => projector.project(
          _report(summaryAr: 'نتيجتك beauty_score عالية'),
        ),
        throwsA(isA<FaceProjectionValidationFailure>()),
      );
    });

    test('provider leakage in raw summary is sanitized before public emit', () {
      final p = projector.project(
        _report(
          summaryAr:
              'شكل بيضاوي locally_calculated raw=0.12 من التحليل التجميلي',
        ),
      );
      expect(p.executiveSummary.supportAr.contains('locally_calculated'), isFalse);
      expect(p.executiveSummary.supportAr.contains('raw='), isFalse);
    });

    test('semantic dedup collapses shape wording variants', () {
      final a = FaceInsightDeduplication.semanticKey(
        shapeId: 'oval',
        metricId: null,
        category: 'shape',
        titleAr: 'الوجه البيضاوي',
      );
      final b = FaceInsightDeduplication.semanticKey(
        shapeId: 'oval',
        metricId: null,
        category: 'shape',
        titleAr: 'شكل وجهك بيضاوي',
      );
      expect(a, b);
    });

    test('region association is illustrative', () {
      final p = projector.project(_report());
      for (final r in p.regions) {
        expect(r.associationTruth, FacePresentationTruthClass.illustrative);
      }
    });

    test('mirror VM first-surface contract fields present', () {
      final p = projector.project(_report(), context: const FaceResultProjectionContext(
        imageRef: 'file://capture.jpg',
      ));
      expect(p.mirror.imageRef, 'file://capture.jpg');
      expect(p.mirror.summary.insights.length, lessThanOrEqualTo(3));
      expect(p.mirror.insightRefs.length, p.mirror.summary.insights.length);
      expect(p.executiveSummary.advisorEntry.analysisId, 'fx1');
    });

    test('all supported Arabic shape labels project', () {
      const shapes = {
        'oval': 'بيضاوي',
        'round': 'مستدير',
        'square': 'مربع',
        'heart': 'قلبي',
        'oblong': 'مستطيل/طويل',
        'diamond': 'ماسي',
        'triangle': 'مثلث/كمثري',
      };
      for (final e in shapes.entries) {
        final p = projector.project(
          _report(shapeId: e.key, shapeAr: e.value),
        );
        expect(p.executiveSummary.primary!.valueLabelAr, e.value);
      }
    });

    test('detail refs stable', () {
      final p = projector.project(_report());
      expect(p.detailRefs, isNotEmpty);
      expect(p.detailRefs.map((d) => d.id).toSet().length, p.detailRefs.length);
    });
  });

  group('semantic safety', () {
    test('confidence is not quality score on insights', () {
      final p = projector.project(_report());
      for (final i in p.executiveSummary.insights) {
        expect(i.confidencePresentation, isNot(FaceConfidencePresentation.show));
      }
    });

    test('ratio presentation is relative not beauty', () {
      final label = FaceNumericVisibilityPolicy.relativeLabelAr(
        'faceWidthHeightRatio',
        80,
      );
      expect(label, contains('متوازنة'));
      expect(label!.contains('جميل'), isFalse);
    });
  });
}
