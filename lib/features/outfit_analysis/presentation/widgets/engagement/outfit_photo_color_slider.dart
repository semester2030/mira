import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../data/helpers/vision_color_mapper.dart';
import '../../../domain/entities/outfit_analysis.dart';
import '../../../domain/services/outfit_color_preview_service.dart';

/// Before/after color tint on the user's photo — upper-body region.
class OutfitPhotoColorSlider extends StatefulWidget {
  final OutfitAnalysis analysis;

  const OutfitPhotoColorSlider({super.key, required this.analysis});

  @override
  State<OutfitPhotoColorSlider> createState() => _OutfitPhotoColorSliderState();
}

class _OutfitPhotoColorSliderState extends State<OutfitPhotoColorSlider> {
  double _blend = 0;
  int _altIndex = 0;

  @override
  Widget build(BuildContext context) {
    final path = widget.analysis.frozenImagePath;
    if (path == null || !File(path).existsSync()) return const SizedBox.shrink();

    final alternatives = OutfitColorPreviewService.alternatives(widget.analysis, max: 4);
    if (alternatives.isEmpty) return const SizedBox.shrink();

    final alt = alternatives[_altIndex.clamp(0, alternatives.length - 1)];
    final tint = Color.lerp(
      alt.currentColor,
      alt.alternativeColor,
      _blend,
    )!;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'معاينة على صورتك',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'اسحبي لترى ${alt.alternativeColorAr} بدلاً من ${alt.currentColorAr}',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.file(File(path), fit: BoxFit.cover),
                  ClipRect(
                    clipper: _UpperBodyClipper(fraction: 0.58),
                    child: ColorFiltered(
                      colorFilter: ColorFilter.mode(
                        tint.withValues(alpha: 0.22 + _blend * 0.38),
                        BlendMode.color,
                      ),
                      child: Image.file(File(path), fit: BoxFit.cover),
                    ),
                  ),
                  Positioned(
                    left: 12,
                    bottom: 12,
                    child: _ColorBadge(label: alt.currentColorAr, color: alt.currentColor),
                  ),
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: _ColorBadge(label: alt.alternativeColorAr, color: alt.alternativeColor),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Text('الحالي', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
              Expanded(
                child: Slider(
                  value: _blend,
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    setState(() => _blend = v);
                  },
                  activeColor: AppColors.secondary,
                  inactiveColor: AppColors.primaryLight,
                ),
              ),
              Text('المقترح', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
            ],
          ),
          if (alternatives.length > 1)
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: alternatives.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final item = alternatives[index];
                  final active = index == _altIndex;
                  return GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        _altIndex = index;
                        _blend = 0;
                      });
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: VisionColorMapper.toDisplayColor(item.alternativeColorAr),
                        border: Border.all(
                          color: active ? AppColors.secondary : Colors.white,
                          width: active ? 2.5 : 1.5,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _UpperBodyClipper extends CustomClipper<Rect> {
  final double fraction;

  _UpperBodyClipper({required this.fraction});

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width, size.height * fraction);

  @override
  bool shouldReclip(covariant _UpperBodyClipper oldClipper) => oldClipper.fraction != fraction;
}

class _ColorBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _ColorBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(label, style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
