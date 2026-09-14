import '../contracts/face_result_vms.dart';
import '../versioning/face_result_projection_versions.dart';

class FaceProjectionValidationFailure implements Exception {
  final String code;
  final String message;
  FaceProjectionValidationFailure(this.code, this.message);

  @override
  String toString() => 'FaceProjectionValidationFailure($code): $message';
}

/// Reject forbidden concepts and provider/internal leakage in public VMs.
abstract final class FaceProjectionValidators {
  FaceProjectionValidators._();

  static const version = FaceResultProjectionVersions.forbiddenPolicy;

  /// Affirmative beauty/attractiveness scoring claims — not disclaimer negation.
  static const forbiddenConcepts = <String>[
    'beauty_score',
    'attractiveness_score',
    'golden_ratio_beauty',
    '3d_depth',
    'bone_scan',
    'medical_diagnosis',
    'درجة جاذبية',
    'درجة جمال',
    'مسح ثلاثي الأبعاد',
    'نسبة الجمال',
  ];

  static const providerLeakTerms = <String>[
    'provider',
    'locally_calculated',
    'raw=',
    'canonical',
    'formulaversion',
    'intelligenceversion',
    'face-report',
    'schema',
    'trace',
    'on_device_landmarks',
    'face-geom-ratios',
    'face-shape-hybrid',
  ];

  static void assertPublicSafe(FaceResultProjection projection) {
    final blobs = <String>[
      projection.executiveSummary.headlineAr,
      projection.executiveSummary.supportAr,
      if (projection.executiveSummary.primary != null) ...[
        projection.executiveSummary.primary!.titleAr,
        projection.executiveSummary.primary!.subtitleAr,
        projection.executiveSummary.primary!.valueLabelAr,
        projection.executiveSummary.primary!.confidenceQualifierAr ?? '',
      ],
      for (final i in projection.executiveSummary.insights) ...[
        i.titleAr,
        i.bodyAr,
      ],
      projection.executiveSummary.nextAction.labelAr,
      for (final l in projection.limitations) ...[l.titleAr, l.bodyAr],
    ];

    for (final text in blobs) {
      final lower = text.toLowerCase();
      for (final term in forbiddenConcepts) {
        if (lower.contains(term.toLowerCase())) {
          throw FaceProjectionValidationFailure(
            'forbidden_concept',
            'Public projection contains forbidden concept "$term"',
          );
        }
      }
      for (final term in providerLeakTerms) {
        if (lower.contains(term.toLowerCase())) {
          throw FaceProjectionValidationFailure(
            'provider_leakage',
            'Public projection leaks internal term "$term"',
          );
        }
      }
    }

    if (projection.executiveSummary.insights.length > 3) {
      throw FaceProjectionValidationFailure(
        'insight_cap',
        'Executive summary exceeds 3 insights',
      );
    }
  }
}
