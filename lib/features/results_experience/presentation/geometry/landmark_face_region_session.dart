import 'dart:io';
import 'dart:ui';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';

import '../../../skin_analysis/presentation/live_face_map/face_mapping_context.dart';
import '../../../skin_analysis/presentation/live_face_map/face_mesh_service.dart';
import '../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'landmark_aligned_face_geometry.dart';
import 'skin_face_map_visual_path_builder.dart';
import 'skin_report_region_builder.dart';

/// Loads MediaPipe mesh for the ephemeral analysis image and builds
/// HIT + VISUAL paths in the display face viewport (BoxFit.cover).
class LandmarkFaceRegionSession {
  LandmarkFaceRegionSession({
    required this.imagePath,
    required this.imageSize,
    required this.hitPaths,
    required this.visualPaths,
    required this.landmarkCount,
    required this.faceBounds,
    required this.debugLandmarks,
  });

  final String imagePath;
  final Size imageSize;

  /// Anatomical linear paths — hit testing + debug outlines.
  final Map<String, Path> hitPaths;

  /// Smooth contained paths — production paint only.
  final Map<String, Path> visualPaths;

  final int landmarkCount;
  final Rect? faceBounds;
  final List<FaceMeshPoint> debugLandmarks;

  /// Backward-compatible alias → hit paths.
  Map<String, Path> get paths => hitPaths;

  bool get isUsable =>
      LandmarkAlignedFaceGeometry.hasCriticalRegions(hitPaths) &&
      landmarkCount >= 400;

  static Future<LandmarkFaceRegionSession?> load({
    required String imagePath,
    required Size viewport,
    FaceMeshService? meshService,
  }) async {
    if (viewport.width <= 0 || viewport.height <= 0) return null;
    final file = File(imagePath);
    if (!await file.exists()) return null;

    final owned = meshService == null;
    final service = meshService ??
        FaceMeshService(regionBuilder: const SkinReportRegionBuilder());
    try {
      await service.initialize();

      final bytes = await file.readAsBytes();
      final codec = await instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      final imageW = frame.image.width.toDouble();
      final imageH = frame.image.height.toDouble();
      frame.image.dispose();

      if (imageW <= 0 || imageH <= 0) return null;

      final meshFrame = await service.processFile(
        file: file,
        mapping: FaceMappingContext(
          rawImageSize: Size(imageW, imageH),
          contentSize: Size(imageW, imageH),
          viewportSize: viewport,
          lensDirection: CameraLensDirection.front,
          mirrorPreview: false,
        ),
      );

      if (!meshFrame.hasFace || meshFrame.debugLandmarks.length < 400) {
        return null;
      }

      final hit = LandmarkAlignedFaceGeometry.hitPathsFromFrame(meshFrame);
      if (!LandmarkAlignedFaceGeometry.hasCriticalRegions(hit)) {
        return null;
      }
      final visual =
          SkinFaceMapVisualPathBuilder.visualPathsFromFrame(meshFrame);

      return LandmarkFaceRegionSession(
        imagePath: imagePath,
        imageSize: Size(imageW, imageH),
        hitPaths: hit,
        visualPaths: visual.isEmpty ? hit : visual,
        landmarkCount: meshFrame.debugLandmarks.length,
        faceBounds: meshFrame.boundingBox,
        debugLandmarks: meshFrame.debugLandmarks,
      );
    } catch (e, st) {
      debugPrint('LandmarkFaceRegionSession.load failed: $e\n$st');
      return null;
    } finally {
      if (owned) {
        await service.dispose();
      }
    }
  }
}
