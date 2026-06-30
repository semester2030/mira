import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../services/outfit_segmentation_service.dart';
import 'outfit_garment_detection_engine.dart';

/// Body-first garment regions — Vision objects constrained by pose anatomy.
abstract final class OutfitVisionRegionBuilder {
  OutfitVisionRegionBuilder._();

  static List<OutfitSegmentRegion> build({
    required List<VisionLocalizedObject> visionObjects,
    required OutfitBodyPoseMetrics pose,
  }) {
    return OutfitGarmentDetectionEngine.detect(
      visionObjects: visionObjects,
      pose: pose,
    );
  }
}
