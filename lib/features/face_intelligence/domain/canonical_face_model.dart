/// Phase 4A — Canonical face model skeleton (Flutter).
///
/// JUSTIFICATION: Client mirror of API face-model-v1.
/// All metrics unavailable until 4B/4C — never invent values.
library;

const faceModelVersion = 'face-model-v1';
const faceIntelligenceVersion = 'face-intel-v1';
const faceFoundationVersion = 'face-foundation-v1';

enum CanonicalFaceMetricId {
  facialThirdsBalance,
  eyeSpacingRatio,
  faceWidthHeightRatio,
  noseToFaceWidthRatio,
  mouthToFaceWidthRatio,
  symmetryCautious,
  faceShape,
}

class CanonicalFaceMetric {
  final CanonicalFaceMetricId id;
  final String displayNameAr;
  final String displayNameEn;
  final double? normalizedValue;
  final String? categoricalValue;
  final int confidence;
  final String availability;
  final String source;
  final List<String> limitations;
  final String? unavailableReason;

  const CanonicalFaceMetric({
    required this.id,
    required this.displayNameAr,
    required this.displayNameEn,
    this.normalizedValue,
    this.categoricalValue,
    required this.confidence,
    required this.availability,
    required this.source,
    required this.limitations,
    this.unavailableReason,
  });
}

class CanonicalFaceModel {
  final String version;
  final String intelligenceVersion;
  final String foundationVersion;
  final List<CanonicalFaceMetric> metrics;
  final bool measurementEligible;
  final List<String> eligibilityReasonCodes;
  final List<String> limitations;

  const CanonicalFaceModel({
    required this.version,
    required this.intelligenceVersion,
    required this.foundationVersion,
    required this.metrics,
    required this.measurementEligible,
    required this.eligibilityReasonCodes,
    required this.limitations,
  });
}

abstract final class CanonicalFaceModelFactory {
  CanonicalFaceModelFactory._();

  static const _catalog = <CanonicalFaceMetricId, (String, String, String)>{
    CanonicalFaceMetricId.facialThirdsBalance: (
      'توازن أثلاث الوجه',
      'Facial thirds balance',
      '4B',
    ),
    CanonicalFaceMetricId.eyeSpacingRatio: (
      'نسبة تباعد العينين',
      'Eye spacing ratio',
      '4B',
    ),
    CanonicalFaceMetricId.faceWidthHeightRatio: (
      'نسبة عرض إلى ارتفاع الوجه',
      'Face width-to-height ratio',
      '4B',
    ),
    CanonicalFaceMetricId.noseToFaceWidthRatio: (
      'نسبة عرض الأنف إلى الوجه',
      'Nose-to-face width ratio',
      '4B',
    ),
    CanonicalFaceMetricId.mouthToFaceWidthRatio: (
      'نسبة عرض الفم إلى الوجه',
      'Mouth-to-face width ratio',
      '4B',
    ),
    CanonicalFaceMetricId.symmetryCautious: (
      'التماثل الظاهر (بحذر)',
      'Apparent symmetry (cautious)',
      '4B',
    ),
    CanonicalFaceMetricId.faceShape: (
      'شكل الوجه',
      'Face shape',
      '4C',
    ),
  };

  static CanonicalFaceModel skeleton({
    required bool measurementEligible,
    required List<String> eligibilityReasonCodes,
  }) {
    final reason = measurementEligible
        ? 'awaiting_geometry_engine_4b'
        : 'measurement_not_eligible';

    final metrics = CanonicalFaceMetricId.values.map((id) {
      final cat = _catalog[id]!;
      return CanonicalFaceMetric(
        id: id,
        displayNameAr: cat.$1,
        displayNameEn: cat.$2,
        confidence: 0,
        availability: 'unavailable',
        source: 'unavailable',
        unavailableReason: reason,
        limitations: [
          'Reserved for Phase ${cat.$3} — not computed in Face Foundation (4A).',
          'Cosmetic facial-feature intelligence — not attractiveness scoring.',
        ],
      );
    }).toList();

    return CanonicalFaceModel(
      version: faceModelVersion,
      intelligenceVersion: faceIntelligenceVersion,
      foundationVersion: faceFoundationVersion,
      metrics: metrics,
      measurementEligible: measurementEligible,
      eligibilityReasonCodes: eligibilityReasonCodes,
      limitations: const [
        'Phase 4A foundation only — geometry and face shape not computed.',
        'Sibling to Skin Intelligence; does not modify SVI or FaceHealthMap.',
        'Cosmetic facial-feature intelligence — not attractiveness scoring.',
      ],
    );
  }
}
