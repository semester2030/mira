/// Phase 4C — Hybrid face-shape classifier (Flutter mirror of API).
///
/// Formula id: face-shape-hybrid-ratios-v1
library;

import 'canonical_face_model.dart';
import 'face_client_mirror_gate.dart';
import 'geometry_anchors.dart';

const faceShapeVersion = 'face-shape-v1';
const faceShapeFormulaId = 'face-shape-hybrid-ratios-v1';

enum FaceShapeId {
  oval,
  round,
  square,
  heart,
  oblong,
  diamond,
  triangle,
}

class FaceShapeClassification {
  final String version;
  final String formulaId;
  final String availability;
  final FaceShapeId? shapeId;
  final int confidence;
  final Map<FaceShapeId, double> scores;
  final Map<String, double> signals;
  final String? unavailableReason;
  final String explanationAr;
  final String explanationEn;
  final List<String> limitations;

  const FaceShapeClassification({
    required this.version,
    required this.formulaId,
    required this.availability,
    this.shapeId,
    required this.confidence,
    required this.scores,
    required this.signals,
    this.unavailableReason,
    required this.explanationAr,
    required this.explanationEn,
    required this.limitations,
  });
}

abstract final class FaceShapeClassifier {
  FaceShapeClassifier._();

  static (String, String) labels(FaceShapeId id) => switch (id) {
        FaceShapeId.oval => ('بيضاوي', 'Oval'),
        FaceShapeId.round => ('مستدير', 'Round'),
        FaceShapeId.square => ('مربع', 'Square'),
        FaceShapeId.heart => ('قلبي', 'Heart'),
        FaceShapeId.oblong => ('مستطيل/طويل', 'Oblong'),
        FaceShapeId.diamond => ('ماسي', 'Diamond'),
        FaceShapeId.triangle => ('مثلث/كمثري', 'Triangle'),
      };

  static FaceShapeClassification classify({
    required bool eligible,
    required List<String> eligibilityReasons,
    GeometryAnchors? anchors,
    String? trackingQuality,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceShapeClassifier');
    const baseLimits = [
      'Cosmetic face-shape taxonomy — not attractiveness scoring.',
      'Not a medical or clinical craniofacial assessment.',
      'Separate from skin type / undertone.',
      'Formula face-shape-hybrid-ratios-v1',
    ];

    if (!eligible) {
      return FaceShapeClassification(
        version: faceShapeVersion,
        formulaId: faceShapeFormulaId,
        availability: 'unavailable',
        confidence: 0,
        scores: const {},
        signals: const {},
        unavailableReason: 'measurement_not_eligible',
        explanationAr: 'شكل الوجه غير متاح — القياس غير مؤهل.',
        explanationEn: 'Face shape unavailable — measurement not eligible.',
        limitations: [...baseLimits, ...eligibilityReasons],
      );
    }

    if (anchors == null) {
      return FaceShapeClassification(
        version: faceShapeVersion,
        formulaId: faceShapeFormulaId,
        availability: 'unavailable',
        confidence: 0,
        scores: const {},
        signals: const {},
        unavailableReason: 'missing_or_invalid_geometry_anchors',
        explanationAr: 'شكل الوجه غير متاح — مراسي غير كافية.',
        explanationEn: 'Face shape unavailable — anchors insufficient.',
        limitations: baseLimits,
      );
    }

    final a = anchors;
    final cheekW = geomDist(a.leftFace, a.rightFace);
    final faceH = geomDist(a.foreheadTop, a.chin);
    final foreheadW = geomDist(a.leftEyeOuter, a.rightEyeOuter);
    final jawW = geomDist(a.leftJaw, a.rightJaw);

    if (cheekW < 1e-6 || faceH < 1e-6 || foreheadW < 1e-6 || jawW < 1e-6) {
      return FaceShapeClassification(
        version: faceShapeVersion,
        formulaId: faceShapeFormulaId,
        availability: 'unavailable',
        confidence: 0,
        scores: const {},
        signals: {
          'cheekW': cheekW,
          'faceH': faceH,
          'foreheadW': foreheadW,
          'jawW': jawW,
        },
        unavailableReason: 'degenerate_face_span',
        explanationAr: 'شكل الوجه غير متاح — أبعاد الوجه degenerate.',
        explanationEn: 'Face shape unavailable — degenerate face spans.',
        limitations: baseLimits,
      );
    }

    final wh = cheekW / faceH;
    final f2c = foreheadW / cheekW;
    final j2c = jawW / cheekW;
    final f2j = foreheadW / jawW;

    final scores = <FaceShapeId, double>{
      FaceShapeId.oblong:
          _falling(wh, 0.62, 0.72) * (0.55 + 0.45 * _near(f2c, 0.95, 0.2)),
      FaceShapeId.round: _rising(wh, 0.82, 0.92) *
          _near(j2c, 0.95, 0.15) *
          _near(f2c, 0.95, 0.15),
      FaceShapeId.square: _rising(wh, 0.76, 0.88) *
          _near(j2c, 1.0, 0.1) *
          _near(f2c, 0.98, 0.12) *
          (1 - 0.35 * _falling(wh, 0.7, 0.78)),
      FaceShapeId.heart: _rising(f2j, 1.08, 1.28) *
          _falling(j2c, 0.72, 0.9) *
          _near(wh, 0.74, 0.14),
      FaceShapeId.triangle: _rising(j2c - f2c, 0.04, 0.14) *
          _rising(j2c, 0.88, 1.02) *
          _near(wh, 0.76, 0.14),
      FaceShapeId.diamond: _falling(f2c, 0.78, 0.92) *
          _falling(j2c, 0.78, 0.92) *
          _near(wh, 0.74, 0.12),
      FaceShapeId.oval: _near(wh, 0.74, 0.1) *
          _near(f2c, 0.92, 0.14) *
          _near(j2c, 0.86, 0.14) *
          (1 - 0.5 * _rising((f2j - 1.05).abs(), 0.12, 0.28)),
    };

    var best = FaceShapeId.oval;
    var bestScore = -1.0;
    var second = 0.0;
    for (final e in scores.entries) {
      if (e.value > bestScore) {
        second = bestScore;
        bestScore = e.value;
        best = e.key;
      } else if (e.value > second) {
        second = e.value;
      }
    }

    if (bestScore < 0.22) {
      return FaceShapeClassification(
        version: faceShapeVersion,
        formulaId: faceShapeFormulaId,
        availability: 'unavailable',
        confidence: 0,
        scores: scores,
        signals: {
          'wh': wh,
          'f2c': f2c,
          'j2c': j2c,
          'f2j': f2j,
          'cheekW': cheekW,
          'faceH': faceH,
          'foreheadW': foreheadW,
          'jawW': jawW,
        },
        unavailableReason: 'low_shape_signal',
        explanationAr: 'إشارة شكل الوجه ضعيفة — لم يُخترع تصنيف.',
        explanationEn: 'Weak face-shape signal — class not invented.',
        limitations: baseLimits,
      );
    }

    final qualityMul = switch (trackingQuality) {
      'high' => 1.0,
      'medium' => 0.9,
      'low' => 0.75,
      _ => 0.85,
    };
    final margin = bestScore - (second < 0 ? 0 : second);
    final confidence =
        _clamp100((48 + margin * 95 + bestScore * 20) * qualityMul);
    final name = labels(best);

    return FaceShapeClassification(
      version: faceShapeVersion,
      formulaId: faceShapeFormulaId,
      availability: 'available',
      shapeId: best,
      confidence: confidence,
      scores: scores,
      signals: {
        'wh': wh,
        'f2c': f2c,
        'j2c': j2c,
        'f2j': f2j,
        'cheekW': cheekW,
        'faceH': faceH,
        'foreheadW': foreheadW,
        'jawW': jawW,
      },
      explanationAr:
          'شكل الوجه الظاهر: ${name.$1} (ثقة $confidence). صيغة هجينة من نسب العرض/الارتفاع والجبهة/الوجنة/الفك.',
      explanationEn:
          'Apparent face shape: ${name.$2} (confidence $confidence). Hybrid ratios of width/height and forehead/cheek/jaw spans.',
      limitations: [
        ...baseLimits,
        'Hybrid heuristic — lighting, hairstyle, and expression can shift class.',
      ],
    );
  }

  static CanonicalFaceModel applyToModel(
    CanonicalFaceModel base,
    FaceShapeClassification shape,
  ) {
    final shapeMetric = _toMetric(shape);
    final metrics = base.metrics
        .map((m) => m.id == CanonicalFaceMetricId.faceShape ? shapeMetric : m)
        .toList();
    return CanonicalFaceModel(
      version: base.version,
      intelligenceVersion: base.intelligenceVersion,
      foundationVersion: base.foundationVersion,
      metrics: metrics,
      measurementEligible: base.measurementEligible,
      eligibilityReasonCodes: base.eligibilityReasonCodes,
      limitations: [
        'Phase 4C face shape applied where signals allow.',
        'Sibling to Skin Intelligence; does not modify SVI or FaceHealthMap.',
        ...shape.limitations.take(2),
      ],
    );
  }

  static CanonicalFaceMetric _toMetric(FaceShapeClassification shape) {
    const names = ('شكل الوجه', 'Face shape');
    if (shape.availability != 'available' || shape.shapeId == null) {
      return CanonicalFaceMetric(
        id: CanonicalFaceMetricId.faceShape,
        displayNameAr: names.$1,
        displayNameEn: names.$2,
        confidence: 0,
        availability: 'unavailable',
        source: 'unavailable',
        unavailableReason: shape.unavailableReason ?? 'shape_unavailable',
        limitations: shape.limitations,
      );
    }
    return CanonicalFaceMetric(
      id: CanonicalFaceMetricId.faceShape,
      displayNameAr: names.$1,
      displayNameEn: names.$2,
      categoricalValue: shape.shapeId!.name,
      normalizedValue: shape.confidence.toDouble(),
      confidence: shape.confidence,
      availability: 'available',
      source: 'locally_calculated',
      limitations: shape.limitations,
    );
  }

  static double _clamp01(double n) => n < 0 ? 0 : (n > 1 ? 1 : n);

  static int _clamp100(double n) =>
      n < 0 ? 0 : (n > 100 ? 100 : n.round());

  static double _near(double value, double target, double tol) =>
      _clamp01(1 - (value - target).abs() / (tol == 0 ? 1e-6 : tol));

  static double _rising(double value, double lo, double hi) {
    if (value <= lo) return 0;
    if (value >= hi) return 1;
    return (value - lo) / (hi - lo);
  }

  static double _falling(double value, double lo, double hi) {
    if (value >= hi) return 0;
    if (value <= lo) return 1;
    return (hi - value) / (hi - lo);
  }
}
