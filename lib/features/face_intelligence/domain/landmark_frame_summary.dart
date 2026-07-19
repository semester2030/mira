/// Phase 4A — Landmark frame summary from existing [FaceMeshFrame].
///
/// JUSTIFICATION: Export boundary so Face Intel never owns MediaPipe types.
/// REUSES FaceMeshFrame / FaceRegionId — does not reimplement mesh service.
library;

import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

const landmarkFrameVersion = 'landmark-frame-v1';

class LandmarkFrameSummary {
  final String version;
  final int pointCount;
  final bool hasOutline;
  final bool hasRegions;
  final List<String> regionIdsPresent;
  final String? trackingQuality;
  final String source;
  final List<String> limitations;

  const LandmarkFrameSummary({
    required this.version,
    required this.pointCount,
    required this.hasOutline,
    required this.hasRegions,
    required this.regionIdsPresent,
    this.trackingQuality,
    required this.source,
    required this.limitations,
  });

  bool get usableForFutureGeometry =>
      hasOutline && pointCount >= 8;
}

abstract final class LandmarkFrameMapper {
  LandmarkFrameMapper._();

  static LandmarkFrameSummary fromMeshFrame(FaceMeshFrame? frame) {
    if (frame == null || !frame.hasFace) {
      return const LandmarkFrameSummary(
        version: landmarkFrameVersion,
        pointCount: 0,
        hasOutline: false,
        hasRegions: false,
        regionIdsPresent: [],
        source: 'unavailable',
        limitations: [
          'No FaceMeshFrame — MediaPipe mesh service remains the sole mesh owner.',
        ],
      );
    }

    final regions = frame.regions
        .where((r) => r.isValid)
        .map((r) => r.id.name)
        .toList();

    return LandmarkFrameSummary(
      version: landmarkFrameVersion,
      pointCount: frame.outline.length,
      hasOutline: frame.hasFace,
      hasRegions: regions.isNotEmpty,
      regionIdsPresent: regions,
      trackingQuality: frame.quality.name,
      source: 'mediapipe_mesh',
      limitations: const [
        'Summary only — raw landmark buffers not retained in Face Intelligence.',
      ],
    );
  }
}
