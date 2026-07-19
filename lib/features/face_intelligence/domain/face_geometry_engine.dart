/// Phase 4B — Face Geometry Engine (Flutter mirror of API formulas).
///
/// Formula id: face-geom-ratios-thirds-sym-v1
/// Does not invent values; faceShape stays unavailable (4C).
library;

import 'dart:math' as math;

import 'canonical_face_model.dart';
import 'face_client_mirror_gate.dart';
import 'geometry_anchors.dart';

const faceGeometryVersion = 'face-geometry-v1';
const faceGeometryFormulaId = 'face-geom-ratios-thirds-sym-v1';

class GeometryComputationResult {
  final String version;
  final String formulaId;
  final List<CanonicalFaceMetric> metrics;
  final Map<String, double> raw;
  final List<String> limitations;

  const GeometryComputationResult({
    required this.version,
    required this.formulaId,
    required this.metrics,
    required this.raw,
    required this.limitations,
  });
}

abstract final class FaceGeometryEngine {
  FaceGeometryEngine._();

  static GeometryComputationResult compute({
    required bool eligible,
    required List<String> eligibilityReasons,
    GeometryAnchors? anchors,
    String? trackingQuality,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceGeometryEngine');
    const baseLimits = [
      'Cosmetic facial geometry — not attractiveness scoring.',
      'Not a medical or clinical craniofacial assessment.',
      'Formula face-geom-ratios-thirds-sym-v1',
    ];

    CanonicalFaceMetric unavailable(CanonicalFaceMetricId id, String reason) {
      final names = _names(id);
      return CanonicalFaceMetric(
        id: id,
        displayNameAr: names.$1,
        displayNameEn: names.$2,
        confidence: 0,
        availability: 'unavailable',
        source: 'unavailable',
        unavailableReason: reason,
        limitations: baseLimits,
      );
    }

    final geomIds = [
      CanonicalFaceMetricId.facialThirdsBalance,
      CanonicalFaceMetricId.eyeSpacingRatio,
      CanonicalFaceMetricId.faceWidthHeightRatio,
      CanonicalFaceMetricId.noseToFaceWidthRatio,
      CanonicalFaceMetricId.mouthToFaceWidthRatio,
      CanonicalFaceMetricId.symmetryCautious,
    ];

    if (!eligible) {
      return GeometryComputationResult(
        version: faceGeometryVersion,
        formulaId: faceGeometryFormulaId,
        metrics: geomIds
            .map((id) => unavailable(id, 'measurement_not_eligible'))
            .toList(),
        raw: const {},
        limitations: [...baseLimits, ...eligibilityReasons],
      );
    }

    if (anchors == null) {
      return GeometryComputationResult(
        version: faceGeometryVersion,
        formulaId: faceGeometryFormulaId,
        metrics: geomIds
            .map((id) => unavailable(id, 'missing_or_invalid_geometry_anchors'))
            .toList(),
        raw: const {},
        limitations: [...baseLimits, 'Geometry anchors missing.'],
      );
    }

    final a = anchors;
    final faceWidth = geomDist(a.leftFace, a.rightFace);
    final faceHeight = geomDist(a.foreheadTop, a.chin);
    if (faceWidth < 1e-6 || faceHeight < 1e-6) {
      return GeometryComputationResult(
        version: faceGeometryVersion,
        formulaId: faceGeometryFormulaId,
        metrics: geomIds
            .map((id) => unavailable(id, 'degenerate_face_span'))
            .toList(),
        raw: {'faceWidth': faceWidth, 'faceHeight': faceHeight},
        limitations: baseLimits,
      );
    }

    final qualityMul = switch (trackingQuality) {
      'high' => 1.0,
      'medium' => 0.9,
      'low' => 0.75,
      _ => 0.85,
    };

    final widthHeight = faceWidth / faceHeight;
    final eyeSpacing = geomDist(a.leftEyeInner, a.rightEyeInner) / faceWidth;
    final noseWidth = geomDist(a.leftAla, a.rightAla) / faceWidth;
    final mouthWidth = geomDist(a.leftMouth, a.rightMouth) / faceWidth;

    final upper = (a.browMid.y - a.foreheadTop.y).abs();
    final middle = (a.noseBase.y - a.browMid.y).abs();
    final lower = (a.chin.y - a.noseBase.y).abs();
    final thirdSum = upper + middle + lower;
    var thirdsBalance = 0.0;
    var thirdsCv = 0.0;
    if (thirdSum > 1e-6) {
      final mean = thirdSum / 3;
      final variance = ((upper - mean) * (upper - mean) +
              (middle - mean) * (middle - mean) +
              (lower - mean) * (lower - mean)) /
          3;
      thirdsCv = math.sqrt(variance) / mean;
      thirdsBalance = _clamp100((1 - _clamp01(thirdsCv / 0.45)) * 100);
    }

    final midX = (a.leftFace.x + a.rightFace.x) / 2;
    final eyeYDev = (a.leftEyeOuter.y - a.rightEyeOuter.y).abs() / faceHeight;
    final mouthYDev = (a.leftMouth.y - a.rightMouth.y).abs() / faceHeight;
    final leftDx = (a.leftFace.x - midX).abs();
    final rightDx = (a.rightFace.x - midX).abs();
    final sideDev = (leftDx - rightDx).abs() / math.max(leftDx + rightDx, 1e-6);
    final asym = (eyeYDev + mouthYDev + sideDev) / 3;
    final symmetryScore = _clamp100((1 - _clamp01(asym / 0.12)) * 100);

    final confBase = _clamp100(78 * qualityMul).round();
    final confSym = _clamp100(62 * qualityMul).round();

    CanonicalFaceMetric avail(
      CanonicalFaceMetricId id,
      double raw,
      double normalized,
      int confidence,
    ) {
      final names = _names(id);
      return CanonicalFaceMetric(
        id: id,
        displayNameAr: names.$1,
        displayNameEn: names.$2,
        normalizedValue: normalized,
        categoricalValue: 'raw=${raw.toStringAsFixed(4)}',
        confidence: confidence,
        availability: 'available',
        source: 'locally_calculated',
        limitations: baseLimits,
      );
    }

    return GeometryComputationResult(
      version: faceGeometryVersion,
      formulaId: faceGeometryFormulaId,
      metrics: [
        avail(
          CanonicalFaceMetricId.faceWidthHeightRatio,
          widthHeight,
          _bandScore(widthHeight, 0.65, 0.9),
          confBase,
        ),
        avail(
          CanonicalFaceMetricId.eyeSpacingRatio,
          eyeSpacing,
          _bandScore(eyeSpacing, 0.28, 0.4),
          confBase,
        ),
        avail(
          CanonicalFaceMetricId.noseToFaceWidthRatio,
          noseWidth,
          _bandScore(noseWidth, 0.18, 0.32),
          confBase,
        ),
        avail(
          CanonicalFaceMetricId.mouthToFaceWidthRatio,
          mouthWidth,
          _bandScore(mouthWidth, 0.32, 0.5),
          confBase,
        ),
        avail(
          CanonicalFaceMetricId.facialThirdsBalance,
          thirdsCv,
          thirdsBalance,
          confBase,
        ),
        avail(
          CanonicalFaceMetricId.symmetryCautious,
          asym,
          symmetryScore,
          confSym,
        ),
      ],
      raw: {
        'faceWidth': faceWidth,
        'faceHeight': faceHeight,
        'widthHeight': widthHeight,
        'eyeSpacing': eyeSpacing,
        'thirdsCv': thirdsCv,
        'asymmetryIndex': asym,
      },
      limitations: baseLimits,
    );
  }

  static CanonicalFaceModel applyToModel(
    CanonicalFaceModel base,
    GeometryComputationResult geometry,
  ) {
    final byId = {for (final m in geometry.metrics) m.id: m};
    final metrics = base.metrics.map((m) {
      if (m.id == CanonicalFaceMetricId.faceShape) {
        final names = _names(m.id);
        return CanonicalFaceMetric(
          id: m.id,
          displayNameAr: names.$1,
          displayNameEn: names.$2,
          confidence: 0,
          availability: 'unavailable',
          source: 'unavailable',
          unavailableReason: 'awaiting_face_shape_engine_4c',
          limitations: const [
            'Face shape reserved for Phase 4C.',
            'Cosmetic facial-feature intelligence — not attractiveness scoring.',
          ],
        );
      }
      return byId[m.id] ?? m;
    }).toList();

    return CanonicalFaceModel(
      version: base.version,
      intelligenceVersion: base.intelligenceVersion,
      foundationVersion: base.foundationVersion,
      metrics: metrics,
      measurementEligible: base.measurementEligible,
      eligibilityReasonCodes: base.eligibilityReasonCodes,
      limitations: [
        'Phase 4B geometry applied where anchors + eligibility allow.',
        'faceShape remains unavailable until Phase 4C.',
        ...geometry.limitations.take(2),
      ],
    );
  }

  static (String, String) _names(CanonicalFaceMetricId id) {
    return switch (id) {
      CanonicalFaceMetricId.facialThirdsBalance => (
          'توازن أثلاث الوجه',
          'Facial thirds balance',
        ),
      CanonicalFaceMetricId.eyeSpacingRatio => (
          'نسبة تباعد العينين',
          'Eye spacing ratio',
        ),
      CanonicalFaceMetricId.faceWidthHeightRatio => (
          'نسبة عرض إلى ارتفاع الوجه',
          'Face width-to-height ratio',
        ),
      CanonicalFaceMetricId.noseToFaceWidthRatio => (
          'نسبة عرض الأنف إلى الوجه',
          'Nose-to-face width ratio',
        ),
      CanonicalFaceMetricId.mouthToFaceWidthRatio => (
          'نسبة عرض الفم إلى الوجه',
          'Mouth-to-face width ratio',
        ),
      CanonicalFaceMetricId.symmetryCautious => (
          'التماثل الظاهر (بحذر)',
          'Apparent symmetry (cautious)',
        ),
      CanonicalFaceMetricId.faceShape => ('شكل الوجه', 'Face shape'),
    };
  }

  static double _clamp01(double n) => n < 0 ? 0 : (n > 1 ? 1 : n);

  static double _clamp100(double n) =>
      n < 0 ? 0 : (n > 100 ? 100 : n.roundToDouble());

  static double _bandScore(double raw, double lo, double hi) {
    final mid = (lo + hi) / 2;
    final half = (hi - lo) / 2;
    final deviation = (raw - mid).abs() / (half == 0 ? 0.01 : half);
    return _clamp100((1 - _clamp01(deviation)) * 100);
  }
}
