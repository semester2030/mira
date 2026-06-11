import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../face_map_debug_config.dart';
import '../live_face_overlay_controller.dart';
import '../models/face_mesh_models.dart';
import '../painters/educational_face_regions_painter.dart';
import '../painters/face_mesh_debug_painter.dart';
import '../painters/live_face_guide_painter.dart';
import 'mira_scanning_badge.dart';
import 'tracking_quality_badge.dart';

/// Premium landmark-accurate face analysis overlay.
class LiveFaceAnalysisOverlay extends StatelessWidget {
  final LiveFaceOverlayController controller;
  final LiveCameraOverlayState uiState;
  final double pulse;
  final double scanProgress;
  final double sweepProgress;

  const LiveFaceAnalysisOverlay({
    super.key,
    required this.controller,
    required this.uiState,
    required this.pulse,
    required this.scanProgress,
    required this.sweepProgress,
    this.hintText = 'انظري للكاميرا مباشرة',
  });

  final String hintText;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final frame = controller.frame;
        final analyzing = uiState == LiveCameraOverlayState.analyzing;
        final showLiveGuide = !analyzing && uiState != LiveCameraOverlayState.captured;
        final canDrawRegions =
            analyzing && frame.outline.length >= 8 && frame.quality.showRegions;

        return Stack(
          fit: StackFit.expand,
          children: [
            if (showLiveGuide)
              RepaintBoundary(
                child: CustomPaint(
                  painter: LiveFaceGuidePainter(
                    frame: frame,
                    pulse: pulse,
                  ),
                ),
              ),
            if (canDrawRegions)
              RepaintBoundary(
                child: CustomPaint(
                  painter: EducationalFaceRegionsPainter(frame: frame),
                ),
              ),

            if (FaceMapDebugConfig.showOverlay && frame.outline.isNotEmpty)
              RepaintBoundary(
                child: CustomPaint(
                  painter: FaceMeshDebugPainter(
                    frame: frame,
                    landmarks: controller.debugLandmarks,
                  ),
                ),
              ),

            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Align(
                alignment: Alignment.topCenter,
                child: analyzing
                    ? const MiraScanningBadge()
                    : TrackingQualityBadge(quality: frame.quality, compact: true),
              ),
            ),

            if (!analyzing && uiState != LiveCameraOverlayState.captured)
              Positioned(
                top: 52,
                left: 16,
                right: 16,
                child: _HintPill(text: hintText),
              ),

            if (uiState == LiveCameraOverlayState.captured)
              const Positioned(
                top: 52,
                left: 16,
                right: 16,
                child: _CapturedBanner(),
              ),

            if (analyzing && !frame.quality.showRegions)
              Positioned(
                bottom: 52,
                left: 16,
                right: 16,
                child: const Center(
                  child: TrackingQualityBadge(quality: FaceTrackingQuality.low),
                ),
              ),

            if (analyzing && frame.quality.showRegions)
              const Positioned(
                left: 16,
                right: 16,
                bottom: 18,
                child: _FullFaceScanLabel(),
              ),

            const Positioned(
              left: 12,
              right: 12,
              bottom: 6,
              child: _SafetyDisclaimer(),
            ),
          ],
        );
      },
    );
  }
}

class _HintPill extends StatelessWidget {
  final String text;
  const _HintPill({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: AppTypography.labelMedium.copyWith(color: AppColors.onPrimary),
      ),
    );
  }
}

class _CapturedBanner extends StatelessWidget {
  const _CapturedBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle_outline, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              'تم التقاط الصورة — جاهزة للتحليل',
              style: AppTypography.labelMedium.copyWith(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _FullFaceScanLabel extends StatelessWidget {
  const _FullFaceScanLabel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFC88BFF).withValues(alpha: 0.35),
        ),
      ),
      child: Text(
        'جاري تحليل مناطق الوجه…',
        textAlign: TextAlign.center,
        style: AppTypography.labelMedium.copyWith(color: AppColors.onPrimary),
      ),
    );
  }
}

class _SafetyDisclaimer extends StatelessWidget {
  const _SafetyDisclaimer();

  @override
  Widget build(BuildContext context) {
    return Text(
      'خريطة تعليمية لمناطق الوجه — ليست تشخيصاً موضعياً.',
      textAlign: TextAlign.center,
      style: AppTypography.labelSmall.copyWith(
        color: AppColors.onPrimary.withValues(alpha: 0.55),
      ),
    );
  }
}
