import '../models/face_mesh_models.dart';
import '../topology/mediapipe_landmark_indices.dart';

/// Crossing metrics for one cheek vs anatomical midline — debug / gate shared.
class CheekMidlineCrossingReport {
  final bool isAnatomicalLeft;
  final int pointCount;
  final int correctSideCount;
  final int wrongSideCount;
  final double correctSideRatio;
  final double majorityThreshold;
  final String centroidSide;
  final bool crossedMidline;
  final String? suppressReason;

  const CheekMidlineCrossingReport({
    required this.isAnatomicalLeft,
    required this.pointCount,
    required this.correctSideCount,
    required this.wrongSideCount,
    required this.correctSideRatio,
    required this.majorityThreshold,
    required this.centroidSide,
    required this.crossedMidline,
    this.suppressReason,
  });
}

/// Anatomical midline + cheek side semantics in ONE viewport space.
///
/// Does not assume screen-left == anatomical-left. Side direction is derived
/// from mapped face landmarks 234 (anatomical left) vs 454 (anatomical right).
abstract final class CheekMidlineCrossing {
  CheekMidlineCrossing._();

  static const midlineLandmarkIndices = <int>[
    MediapipeLandmarkIndices.geometryBrowMid, // 9
    MediapipeLandmarkIndices.geometryNoseTip, // 1
    MediapipeLandmarkIndices.geometryNoseBase, // 2
    MediapipeLandmarkIndices.geometryChin, // 152
  ];

  static const leftCheekLandmarkIndices = MediapipeLandmarkIndices.leftCheek;
  static const rightCheekLandmarkIndices = MediapipeLandmarkIndices.rightCheek;

  /// In this coordinate space, is anatomical left toward lower X?
  static bool anatomicalLeftIsLowerX({
    required double leftFaceX,
    required double rightFaceX,
  }) =>
      leftFaceX <= rightFaceX;

  static double midlineXFromAnchors(List<FaceMeshPoint> anchors) {
    if (anchors.isEmpty) return 0;
    return anchors.map((p) => p.x).reduce((a, b) => a + b) / anchors.length;
  }

  static CheekMidlineCrossingReport evaluate({
    required List<FaceMeshPoint> cheekPoints,
    required bool isAnatomicalLeft,
    required double midlineX,
    required bool anatomicalLeftIsLowerX,
    double majorityFraction = 0.55,
  }) {
    final n = cheekPoints.length;
    if (n == 0) {
      return const CheekMidlineCrossingReport(
        isAnatomicalLeft: true,
        pointCount: 0,
        correctSideCount: 0,
        wrongSideCount: 0,
        correctSideRatio: 0,
        majorityThreshold: 0.55,
        centroidSide: 'N/A',
        crossedMidline: true,
        suppressReason: 'too_few_points',
      );
    }

    final wantsLowerX = isAnatomicalLeft
        ? anatomicalLeftIsLowerX
        : !anatomicalLeftIsLowerX;

    var correct = 0;
    for (final p in cheekPoints) {
      final onLower = p.x < midlineX;
      final onUpper = p.x > midlineX;
      if (wantsLowerX ? onLower : onUpper) correct++;
    }
    // Points exactly on midline count neither wrong nor correct for ratio
    // denominator uses all points (conservative).
    final wrong = n - correct;
    final ratio = correct / n;
    final majority = (n * majorityFraction).ceil();
    final crossed = correct < majority;

    final cx = cheekPoints.map((p) => p.x).reduce((a, b) => a + b) / n;
    final centroidSide = cx < midlineX
        ? (anatomicalLeftIsLowerX ? 'ANAT_LEFT' : 'ANAT_RIGHT')
        : (anatomicalLeftIsLowerX ? 'ANAT_RIGHT' : 'ANAT_LEFT');

    return CheekMidlineCrossingReport(
      isAnatomicalLeft: isAnatomicalLeft,
      pointCount: n,
      correctSideCount: correct,
      wrongSideCount: wrong,
      correctSideRatio: ratio,
      majorityThreshold: majorityFraction,
      centroidSide: centroidSide,
      crossedMidline: crossed,
      suppressReason: crossed ? 'cheek_crossed_midline' : null,
    );
  }
}
