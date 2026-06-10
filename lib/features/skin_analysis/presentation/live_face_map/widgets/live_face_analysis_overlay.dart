import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../live_face_overlay_controller.dart';
import '../models/face_mesh_models.dart';
import '../painters/educational_face_regions_painter.dart';
import '../scan_region_animation.dart';
import 'mira_scanning_badge.dart';
import 'tracking_quality_badge.dart';

/// Premium live face-map overlay — sequential purple scan, educational only.
class LiveFaceAnalysisOverlay extends StatelessWidget {
  final LiveFaceOverlayController controller;
  final LiveCameraOverlayState uiState;
  final double pulse;
  final double scanProgress;

  const LiveFaceAnalysisOverlay({
    super.key,
    required this.controller,
    required this.uiState,
    required this.pulse,
    required this.scanProgress,
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
        final showRegions = analyzing && frame.quality.showRegions;
        final activeRegion = ScanRegionAnimation.activeStepIndex(scanProgress);

        return Stack(
          fit: StackFit.expand,
          children: [
            if (analyzing)
              Container(color: Colors.black.withValues(alpha: 0.10)),

            if (showRegions)
              RepaintBoundary(
                child: CustomPaint(
                  painter: EducationalFaceRegionsPainter(
                    frame: frame,
                    scanProgress: scanProgress,
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

            if (uiState == LiveCameraOverlayState.initial)
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

            if (!frame.quality.showRegions && !analyzing)
              Positioned(
                bottom: 52,
                left: 16,
                right: 16,
                child: Center(child: TrackingQualityBadge(quality: frame.quality)),
              ),

            if (analyzing)
              Positioned(
                left: 16,
                right: 16,
                bottom: 18,
                child: _RegionScanLabel(activeIndex: activeRegion),
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

class _RegionScanLabel extends StatelessWidget {
  final int activeIndex;
  const _RegionScanLabel({required this.activeIndex});

  static const _labels = [
    'جاري تحليل الجبهة…',
    'جاري تحليل منطقة تحت العين…',
    'جاري تحليل الأنف…',
    'جاري تحليل الخدين…',
    'جاري تحليل الذقن…',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFA855F7).withValues(alpha: 0.35),
        ),
      ),
      child: Text(
        _labels[activeIndex.clamp(0, _labels.length - 1)],
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
