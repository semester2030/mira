import '../../../skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';

/// Conservative landmark index sets for Skin Report Face Map only.
///
/// Live capture guidance may use fuller loops; report regions must stay on
/// skin and avoid hair / background / eye / mouth bleed.
///
/// Face Mesh does NOT know the true hairline — forehead is intentionally
/// brow-anchored and only partially extended toward the top forehead landmark.
abstract final class SkinReportLandmarkIndices {
  SkinReportLandmarkIndices._();

  /// Brow ridge (lower forehead boundary) — anatomical, not hairline.
  static const browRidge = <int>[
    70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300,
  ];

  /// Upper forehead support points (NOT used at full extent — see builder lerp).
  static const foreheadTopSupport = <int>[
    54, 103, 67, 109, 10, 338, 297, 332, 284,
  ];

  /// Nose — bridge, tip, alae.
  static const nose = MediapipeLandmarkIndices.nose;

  /// Anatomical LEFT cheek — same malar set as live capture (single source).
  static const leftCheek = MediapipeLandmarkIndices.leftCheek;

  /// Anatomical RIGHT cheek — same malar set as live capture (single source).
  static const rightCheek = MediapipeLandmarkIndices.rightCheek;

  /// Lower lip upper bound for chin.
  static const lowerLip = MediapipeLandmarkIndices.lowerLip;

  /// Center chin / jaw only — no temple bleed.
  static const chinArcTight = <int>[
    176, 149, 150, 136, 172, 152, 397, 365, 379, 378, 400, 377, 148,
  ];
}
