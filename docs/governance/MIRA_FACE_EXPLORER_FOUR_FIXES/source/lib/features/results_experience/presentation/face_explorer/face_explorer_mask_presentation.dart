import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

import '../geometry/skin_face_map_visual_tokens.dart';

/// One resolved mask and one decoding flag for the stage AND rectangular lens.
@immutable
class FaceExplorerMaskPresentation {
  const FaceExplorerMaskPresentation({
    required this.profile,
    this.maskBytes,
    this.presentationDecoded = false,
  });

  factory FaceExplorerMaskPresentation.resolve({
    required PerfectMaskPresentationProfile profile,
    required bool showSpatialOverlay,
    Uint8List? remappedBytes,
    Uint8List? rawBytes,
  }) {
    if (!showSpatialOverlay) {
      return FaceExplorerMaskPresentation(profile: profile);
    }
    if (remappedBytes != null && remappedBytes.isNotEmpty) {
      return FaceExplorerMaskPresentation(
        profile: profile,
        maskBytes: remappedBytes,
        presentationDecoded: true,
      );
    }
    return FaceExplorerMaskPresentation(
      profile: profile,
      maskBytes: rawBytes != null && rawBytes.isNotEmpty ? rawBytes : null,
      // Raw fallback must go through the renderer's raw-mask decoding path.
      presentationDecoded: false,
    );
  }

  final Uint8List? maskBytes;
  final bool presentationDecoded;
  final PerfectMaskPresentationProfile profile;

  /// Display calibration only. Keep existing signal gates and spatial support.
  /// Never change analysis scores, add paths, expand masks, or infer regions.
  /// These values still require acceptance with real masks on the target phone.
  static PerfectMaskPresentationProfile profileForConcern(String? concernId) {
    final base = SkinFaceMapVisualTokens.presentationProfileForConcern(concernId);
    final isPath = identical(base, PerfectMaskPresentationProfile.wrinkles);
    final isPoint = identical(base, PerfectMaskPresentationProfile.pores) ||
        identical(base, PerfectMaskPresentationProfile.acne) ||
        identical(base, PerfectMaskPresentationProfile.pigmentation);
    final isOil = identical(base, PerfectMaskPresentationProfile.oiliness);
    if (!isPath && !isPoint && !isOil) return base;

    return PerfectMaskPresentationProfile(
      opacity: math.max(base.opacity, isPath ? 0.96 : (isPoint ? 0.94 : 0.84)),
      tintAlpha: 1.0,
      // No second paint, glow, blur, dilation or extra contour geometry.
      softPresenceFactor: 0.0,
      softPresenceCap: 0.0,
      alphaMode: base.alphaMode,
      alphaGain: base.alphaGain,
      luminanceGateFloor: base.luminanceGateFloor,
      // Only already-visible point/path pixels get a stronger alpha floor.
      // Area masks retain their gradation rather than getting a solid fill.
      minVisibleAlpha: isPath
          ? math.max(base.minVisibleAlpha, 210)
          : (isPoint ? math.max(base.minVisibleAlpha, 200) : base.minVisibleAlpha),
    );
  }
}
