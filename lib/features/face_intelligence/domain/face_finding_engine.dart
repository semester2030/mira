/// Phase 4C — Explainable face feature findings (Flutter mirror).
library;

import 'canonical_face_model.dart';
import 'face_geometry_engine.dart';
import 'face_shape_classifier.dart';

enum FaceFindingSeverity { info, notable }

enum FaceFindingCategory { shape, proportion, symmetryNote }

class FaceFinding {
  final String id;
  final FaceFindingCategory category;
  final List<String> metricIds;
  final String titleAr;
  final String titleEn;
  final String detailAr;
  final String detailEn;
  final FaceFindingSeverity severity;
  final String confidence;
  final bool recommendationEligible;
  final int priority;
  final List<String> limitations;
  final String source;

  const FaceFinding({
    required this.id,
    required this.category,
    required this.metricIds,
    required this.titleAr,
    required this.titleEn,
    required this.detailAr,
    required this.detailEn,
    required this.severity,
    required this.confidence,
    required this.recommendationEligible,
    required this.priority,
    required this.limitations,
    required this.source,
  });
}

abstract final class FaceFindingEngine {
  FaceFindingEngine._();

  static List<FaceFinding> build({
    required CanonicalFaceModel model,
    required FaceShapeClassification shape,
    required GeometryComputationResult geometry,
  }) {
    final findings = <FaceFinding>[];
    const limits = [
      'Cosmetic styling finding — not a medical diagnosis.',
      'Not attractiveness scoring.',
      'Independent of skin type / undertone.',
    ];

    if (shape.availability == 'available' && shape.shapeId != null) {
      final id = shape.shapeId!;
      final name = FaceShapeClassifier.labels(id);
      findings.add(
        FaceFinding(
          id: 'face_shape_${id.name}',
          category: FaceFindingCategory.shape,
          metricIds: const ['faceShape'],
          titleAr: 'شكل الوجه: ${name.$1}',
          titleEn: 'Face shape: ${name.$2}',
          detailAr: _shapeDetailAr(id),
          detailEn: _shapeDetailEn(id),
          severity: FaceFindingSeverity.info,
          confidence: _confBand(shape.confidence),
          recommendationEligible: true,
          priority: 10,
          limitations: limits,
          source: faceShapeFormulaId,
        ),
      );

      if (id == FaceShapeId.oblong) {
        findings.add(
          FaceFinding(
            id: 'elongated_vertical_proportion',
            category: FaceFindingCategory.proportion,
            metricIds: const ['faceWidthHeightRatio', 'faceShape'],
            titleAr: 'نِسَب عمودية أطول ظاهرياً',
            titleEn: 'Apparently elongated vertical proportions',
            detailAr: 'ارتفاع الوجه أكبر نسبياً من العرض في القياس الحالي.',
            detailEn:
                'Face height is relatively larger than width in the current measurement.',
            severity: FaceFindingSeverity.notable,
            confidence: _confBand(shape.confidence),
            recommendationEligible: true,
            priority: 20,
            limitations: limits,
            source: faceShapeFormulaId,
          ),
        );
      }
      if (id == FaceShapeId.heart) {
        findings.add(
          FaceFinding(
            id: 'narrower_lower_face',
            category: FaceFindingCategory.proportion,
            metricIds: const ['faceShape'],
            titleAr: 'جزء سفلي أضيق ظاهرياً',
            titleEn: 'Apparently narrower lower face',
            detailAr: 'عرض الفك أقل نسبياً من الجبهة في المراسي الحالية.',
            detailEn:
                'Jaw span is relatively smaller than forehead in current anchors.',
            severity: FaceFindingSeverity.info,
            confidence: _confBand(shape.confidence),
            recommendationEligible: true,
            priority: 25,
            limitations: limits,
            source: faceShapeFormulaId,
          ),
        );
      }
      if (id == FaceShapeId.triangle) {
        findings.add(
          FaceFinding(
            id: 'wider_lower_face',
            category: FaceFindingCategory.proportion,
            metricIds: const ['faceShape'],
            titleAr: 'جزء سفلي أعرض ظاهرياً',
            titleEn: 'Apparently wider lower face',
            detailAr: 'عرض الفك أكبر نسبياً من الجبهة في المراسي الحالية.',
            detailEn:
                'Jaw span is relatively larger than forehead in current anchors.',
            severity: FaceFindingSeverity.info,
            confidence: _confBand(shape.confidence),
            recommendationEligible: true,
            priority: 25,
            limitations: limits,
            source: faceShapeFormulaId,
          ),
        );
      }
    }

    final byId = {for (final m in model.metrics) m.id: m};
    final thirds = byId[CanonicalFaceMetricId.facialThirdsBalance];
    if (thirds?.availability == 'available' &&
        (thirds!.normalizedValue ?? 0) >= 70) {
      findings.add(
        FaceFinding(
          id: 'balanced_facial_thirds',
          category: FaceFindingCategory.proportion,
          metricIds: const ['facialThirdsBalance'],
          titleAr: 'توازن أثلاث وجه جيد ظاهرياً',
          titleEn: 'Apparently balanced facial thirds',
          detailAr: 'درجة توازن الأثلاث ${thirds.normalizedValue}.',
          detailEn: 'Facial thirds balance score ${thirds.normalizedValue}.',
          severity: FaceFindingSeverity.info,
          confidence: _confBand(thirds.confidence),
          recommendationEligible: true,
          priority: 40,
          limitations: limits,
          source: faceGeometryFormulaId,
        ),
      );
    }

    final sym = byId[CanonicalFaceMetricId.symmetryCautious];
    if (sym?.availability == 'available' &&
        (sym!.normalizedValue ?? 100) < 55) {
      findings.add(
        FaceFinding(
          id: 'soft_asymmetry_note',
          category: FaceFindingCategory.symmetryNote,
          metricIds: const ['symmetryCautious'],
          titleAr: 'ملاحظة تماثل ظاهري حذرة',
          titleEn: 'Cautious apparent-symmetry note',
          detailAr:
              'انحراف L/R ظاهري أعلى من النطاق الهادئ — قد يكون بسبب الوضعية أو التعبير، وليس تشخيصاً.',
          detailEn:
              'Apparent L/R deviation above the calm band — may be pose/expression; not a diagnosis.',
          severity: FaceFindingSeverity.notable,
          confidence: _confBand(sym.confidence),
          recommendationEligible: false,
          priority: 50,
          limitations: [
            ...limits,
            'Symmetry note is cautious and pose-sensitive.',
          ],
          source: faceGeometryFormulaId,
        ),
      );
    }

    // Keep signature parity with API; geometry evidence is optional.
    // ignore: unused_local_variable
    final _ = geometry;

    findings.sort((a, b) => a.priority.compareTo(b.priority));
    return findings;
  }

  static String _confBand(int c) {
    if (c <= 0) return 'unavailable';
    if (c >= 80) return 'high';
    if (c >= 55) return 'medium';
    return 'low';
  }

  static String _shapeDetailAr(FaceShapeId id) => switch (id) {
        FaceShapeId.oval =>
          'نسب متوازنة نسبياً بين العرض والارتفاع مع فك أضيق قليلاً من الوجنة.',
        FaceShapeId.round =>
          'عرض أقرب للارتفاع مع تقارب عروض الجبهة والوجنة والفك.',
        FaceShapeId.square =>
          'عرض/ارتفاع أقصر مع فك قريب من عرض الوجنة (تصنيف تجميلي ظاهري).',
        FaceShapeId.heart => 'جبهة أعرض نسبياً من الفك السفلي الظاهر.',
        FaceShapeId.oblong => 'ارتفاع الوجه أطول نسبياً مقارنة بالعرض.',
        FaceShapeId.diamond =>
          'الوجنة هي الأعرض نسبياً مقابل جبهة وفك أضيق.',
        FaceShapeId.triangle => 'الفك أعرض نسبياً من الجبهة الظاهرة.',
      };

  static String _shapeDetailEn(FaceShapeId id) => switch (id) {
        FaceShapeId.oval =>
          'Relatively balanced width/height with a jaw slightly narrower than the cheeks.',
        FaceShapeId.round =>
          'Width closer to height with similar forehead, cheek, and jaw spans.',
        FaceShapeId.square =>
          'Shorter width/height with jaw near cheek width (cosmetic apparent class).',
        FaceShapeId.heart =>
          'Forehead relatively wider than the apparent lower jaw.',
        FaceShapeId.oblong =>
          'Face height relatively longer compared with width.',
        FaceShapeId.diamond =>
          'Cheeks relatively widest versus narrower forehead and jaw.',
        FaceShapeId.triangle =>
          'Jaw relatively wider than the apparent forehead.',
      };
}
