import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/outfit_segment_map.dart';

/// Overlays outfit segmentation boxes on the frozen image.
class OutfitSegmentMapOverlay extends StatelessWidget {
  final File imageFile;
  final OutfitSegmentMap segmentMap;

  const OutfitSegmentMapOverlay({
    super.key,
    required this.imageFile,
    required this.segmentMap,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: AspectRatio(
        aspectRatio: segmentMap.imageWidth > 0 && segmentMap.imageHeight > 0
            ? segmentMap.imageWidth / segmentMap.imageHeight
            : 3 / 4,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.file(imageFile, fit: BoxFit.cover),
            ...segmentMap.regions.map(
              (region) => _RegionBox(region: region),
            ),
          ],
        ),
      ),
    );
  }
}

class _RegionBox extends StatelessWidget {
  final OutfitSegmentRegion region;

  const _RegionBox({required this.region});

  @override
  Widget build(BuildContext context) {
    final rect = region.normalizedRect;
    return LayoutBuilder(
      builder: (context, constraints) {
        final box = Rect.fromLTWH(
          rect.left * constraints.maxWidth,
          rect.top * constraints.maxHeight,
          rect.width * constraints.maxWidth,
          rect.height * constraints.maxHeight,
        );

        return Stack(
          children: [
            Positioned.fromRect(
              rect: box,
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.9),
                    width: 2,
                  ),
                  borderRadius: BorderRadius.circular(8),
                  color: AppColors.gold.withValues(alpha: 0.08),
                ),
              ),
            ),
            Positioned(
              left: box.left + 4,
              top: box.top + 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  region.labelAr,
                  style: AppTypography.labelSmall.copyWith(color: AppColors.onPrimary),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
