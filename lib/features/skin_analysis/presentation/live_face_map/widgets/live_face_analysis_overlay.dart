import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../models/face_mesh_models.dart';
import '../scan_region_animation.dart';
import '../painters/educational_face_regions_painter.dart';
import '../painters/face_mesh_debug_painter.dart';
import '../painters/face_tracking_ring_painter.dart';
import '../painters/interactive_region_glow_painter.dart';
import '../painters/live_face_guide_painter.dart';
import '../painters/premium_wireframe_mesh_painter.dart';
import '../painters/scanning_line_painter.dart';
import '../face_map_debug_config.dart';
import '../live_face_overlay_controller.dart';
import 'mira_scanning_badge.dart';
import 'tracking_quality_badge.dart';

/// Premium landmark-accurate face analysis overlay with live WOW interactions.
class LiveFaceAnalysisOverlay extends StatelessWidget {
  final LiveFaceOverlayController controller;
  final LiveCameraOverlayState uiState;
  final double pulse;
  final double scanProgress;
  final double sweepProgress;
  final bool lockOn;

  const LiveFaceAnalysisOverlay({
    super.key,
    required this.controller,
    required this.uiState,
    required this.pulse,
    required this.scanProgress,
    required this.sweepProgress,
    this.lockOn = false,
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
        final liveCapture = !analyzing && uiState != LiveCameraOverlayState.captured;
        final showLiveWow = liveCapture && frame.hasFace;
        final showGuide = liveCapture && !frame.hasFace;
        final canDrawRegions =
            analyzing && frame.outline.length >= 8 && frame.quality.showRegions;
        final activeRegion = ScanRegionAnimation.activeRegionId(scanProgress);

        return Stack(
          fit: StackFit.expand,
          children: [
            if (showGuide)
              RepaintBoundary(
                child: CustomPaint(
                  painter: LiveFaceGuidePainter(
                    frame: frame,
                    pulse: pulse,
                  ),
                ),
              ),

            if (showLiveWow) ...[
              RepaintBoundary(
                child: CustomPaint(
                  painter: FaceTrackingRingPainter(
                    frame: frame,
                    pulse: pulse,
                    lockOn: lockOn,
                  ),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: PremiumWireframeMeshPainter(
                    frame: frame,
                    landmarks: controller.debugLandmarks,
                    pulse: pulse,
                    lockOn: lockOn,
                  ),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: InteractiveRegionGlowPainter(
                    frame: frame,
                    scanProgress: scanProgress,
                    pulse: pulse,
                  ),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: ScanningLinePainter(
                    outline: frame.outline,
                    progress: sweepProgress,
                  ),
                ),
              ),
            ],

            if (canDrawRegions) ...[
              RepaintBoundary(
                child: CustomPaint(
                  painter: PremiumWireframeMeshPainter(
                    frame: frame,
                    landmarks: controller.debugLandmarks,
                    pulse: pulse,
                    lockOn: true,
                  ),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: InteractiveRegionGlowPainter(
                    frame: frame,
                    scanProgress: scanProgress,
                    pulse: pulse,
                    dimInactive: false,
                  ),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: EducationalFaceRegionsPainter(frame: frame),
                ),
              ),
              RepaintBoundary(
                child: CustomPaint(
                  painter: ScanningLinePainter(
                    outline: frame.outline,
                    progress: sweepProgress,
                  ),
                ),
              ),
            ],

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
                    ? MiraScanningBadge(pulse: pulse)
                    : TrackingQualityBadge(
                        quality: frame.quality,
                        compact: true,
                        lockOn: lockOn,
                      ),
              ),
            ),

            if (showLiveWow)
              Positioned(
                top: 52,
                left: 16,
                right: 16,
                child: _ActiveRegionPill(
                  regionId: activeRegion,
                  lockOn: lockOn,
                ),
              ),

            if (showGuide)
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
              Positioned(
                left: 16,
                right: 16,
                bottom: 18,
                child: _FullFaceScanLabel(regionId: activeRegion),
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

class _ActiveRegionPill extends StatelessWidget {
  final FaceRegionId regionId;
  final bool lockOn;

  const _ActiveRegionPill({
    required this.regionId,
    required this.lockOn,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: lockOn
              ? AppColors.gold.withValues(alpha: 0.75)
              : const Color(0xFF5CE1FF).withValues(alpha: 0.45),
        ),
        boxShadow: [
          BoxShadow(
            color: (lockOn ? AppColors.gold : const Color(0xFF5CE1FF))
                .withValues(alpha: 0.18),
            blurRadius: 16,
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            lockOn ? Icons.lock_rounded : Icons.radar_rounded,
            size: 16,
            color: lockOn ? AppColors.gold : const Color(0xFF5CE1FF),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              lockOn
                  ? 'تم التثبيت — اضغطي للتصوير'
                  : 'مسح: ${regionId.labelAr}',
              textAlign: TextAlign.center,
              style: AppTypography.labelMedium.copyWith(color: AppColors.onPrimary),
            ),
          ),
        ],
      ),
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
  final FaceRegionId regionId;

  const _FullFaceScanLabel({required this.regionId});

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
        'تحليل ${regionId.labelAr}…',
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
