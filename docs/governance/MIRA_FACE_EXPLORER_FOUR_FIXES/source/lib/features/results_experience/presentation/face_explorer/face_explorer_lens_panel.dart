import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../geometry/face_explorer_lens_geometry.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import '../widgets/perfect_mask_overlay.dart';
import 'face_explorer_controller.dart';
import 'face_explorer_mask_presentation.dart';

/// Rectangular lens panel below the face (×2/×3 + H/V sliders).
class FaceExplorerLensPanel extends StatelessWidget {
  const FaceExplorerLensPanel({
    super.key,
    required this.sourceBytes,
    required this.tint,
    required this.presentation,
    required this.focusSourceNorm,
    required this.zoom,
    required this.stageViewport,
    required this.sourceWidth,
    required this.sourceHeight,
    required this.onToggleZoom,
    required this.onHorizontal,
    required this.onVertical,
  });

  final Uint8List? sourceBytes;
  final Color tint;
  final FaceExplorerMaskPresentation presentation;
  final Offset focusSourceNorm;
  final double zoom;
  final Size? stageViewport;
  final int? sourceWidth;
  final int? sourceHeight;
  final VoidCallback onToggleZoom;
  final ValueChanged<double> onHorizontal;
  final ValueChanged<double> onVertical;

  @override
  Widget build(BuildContext context) {
    final src = sourceBytes;
    if (src == null || src.isEmpty) return const SizedBox.shrink();
    final sourceSize = (sourceWidth != null &&
            sourceHeight != null &&
            sourceWidth! > 0 &&
            sourceHeight! > 0)
        ? Size(sourceWidth!.toDouble(), sourceHeight!.toDouble())
        : null;
    final stageSize = stageViewport;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'موضع التكبير المحدد على الوجه',
                  style: AppTypography.labelSmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: SkinFaceMapVisualTokens.explorerOnBlack,
                  ),
                ),
              ),
              TextButton(
                onPressed: onToggleZoom,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  minimumSize: const Size(44, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: Text(
                  zoom == 3.0 ? '×3' : '×2',
                  style: AppTypography.labelMedium.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 150,
              width: double.infinity,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  if (sourceSize == null || stageSize == null) {
                    return const ColoredBox(
                      color: SkinFaceMapVisualTokens.explorerStage,
                    );
                  }
                  final imageRect = FaceExplorerLensGeometry.imageRect(
                    sourceSize: sourceSize,
                    stageViewport: stageSize,
                    lensViewport: Size(
                      constraints.maxWidth,
                      constraints.maxHeight,
                    ),
                    focusSourceNorm: focusSourceNorm,
                    zoom: zoom,
                  );
                  if (imageRect.isEmpty) return const SizedBox.shrink();
                  // Position the full-resolution image and mask together.
                  // Their viewport has the source aspect ratio; neither layer
                  // is independently fitted into the short rectangular lens.
                  return ColoredBox(
                    color: SkinFaceMapVisualTokens.explorerStage,
                    child: Stack(
                      fit: StackFit.expand,
                      clipBehavior: Clip.hardEdge,
                      children: [
                        Positioned.fromRect(
                          rect: imageRect,
                          child: RepaintBoundary(
                            child: PerfectMaskOverlay(
                              sourceBytes: src,
                              maskBytes: presentation.maskBytes,
                              tint: tint,
                              profile: presentation.profile,
                              opacity: presentation.profile.opacity,
                              presentationDecoded:
                                  presentation.presentationDecoded,
                              sourceWidth: sourceWidth,
                              sourceHeight: sourceHeight,
                              fadeDuration: Duration.zero,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 9),
          _LensSlider(
            label: 'موضع العدسة أفقيًا',
            value: focusSourceNorm.dx.clamp(0.05, 0.95),
            onChanged: onHorizontal,
          ),
          _LensSlider(
            label: 'موضع العدسة رأسيًا',
            value: focusSourceNorm.dy.clamp(0.05, 0.95),
            onChanged: onVertical,
          ),
        ],
      ),
    );
  }
}

class _LensSlider extends StatelessWidget {
  const _LensSlider({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: AppTypography.labelSmall.copyWith(
                fontSize: 11,
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
            ),
          ),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 3,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
              ),
              child: Slider(
                value: value,
                min: 0.05,
                max: 0.95,
                onChanged: onChanged,
                activeColor: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compare + open-lens action row.
class FaceExplorerActionRow extends StatelessWidget {
  const FaceExplorerActionRow({
    super.key,
    required this.holdingOriginal,
    required this.lensPanelOpen,
    required this.onCompareDown,
    required this.onCompareUp,
    required this.onToggleLens,
  });

  final bool holdingOriginal;
  final bool lensPanelOpen;
  final VoidCallback onCompareDown;
  final VoidCallback onCompareUp;
  final VoidCallback onToggleLens;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionChipButton(
            icon: Icons.layers_outlined,
            label: 'اضغطي للمقارنة',
            pressed: holdingOriginal,
            onPointerDown: onCompareDown,
            onPointerUp: onCompareUp,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ActionChipButton(
            icon: Icons.zoom_in_rounded,
            label: 'تكبير موضع',
            pressed: lensPanelOpen,
            onTap: onToggleLens,
          ),
        ),
      ],
    );
  }
}

/// Forehead / nose / cheek — move lens only.
class FaceExplorerFocusShortcutsRow extends StatelessWidget {
  const FaceExplorerFocusShortcutsRow({
    super.key,
    required this.activeId,
    required this.onSelect,
  });

  final String? activeId;
  final ValueChanged<FaceExplorerFocusShortcut> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'انتقلي إلى موضع للفحص',
          style: AppTypography.labelSmall.copyWith(
            fontWeight: FontWeight.w800,
            color: SkinFaceMapVisualTokens.explorerOnBlack,
          ),
        ),
        const SizedBox(height: 7),
        Row(
          children: FaceExplorerController.focusShortcuts.map((s) {
            final on = activeId == s.id;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Material(
                  color: on
                      ? AppColors.primary.withValues(alpha: 0.12)
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => onSelect(s),
                    child: Container(
                      alignment: Alignment.center,
                      constraints: const BoxConstraints(minHeight: 44),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: on
                              ? AppColors.primary
                              : AppColors.border.withValues(alpha: 0.45),
                        ),
                      ),
                      child: Text(
                        s.labelAr,
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                          color: on
                              ? AppColors.primaryDark
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            'تحديد موضع التكبير لا يعني قياسًا مستقلًا للمنطقة.',
            style: AppTypography.labelSmall.copyWith(
              color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              fontSize: 11,
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionChipButton extends StatelessWidget {
  const _ActionChipButton({
    required this.icon,
    required this.label,
    this.pressed = false,
    this.onTap,
    this.onPointerDown,
    this.onPointerUp,
  });

  final IconData icon;
  final String label;
  final bool pressed;
  final VoidCallback? onTap;
  final VoidCallback? onPointerDown;
  final VoidCallback? onPointerUp;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      constraints: const BoxConstraints(minHeight: 44),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: pressed
            ? AppColors.primary.withValues(alpha: 0.12)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: pressed
              ? AppColors.primary
              : AppColors.border.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: AppColors.textSecondary),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: AppTypography.labelSmall.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: SkinFaceMapVisualTokens.explorerOnBlack,
              ),
            ),
          ),
        ],
      ),
    );
    if (onPointerDown != null || onPointerUp != null) {
      return Listener(
        onPointerDown: (_) => onPointerDown?.call(),
        onPointerUp: (_) => onPointerUp?.call(),
        onPointerCancel: (_) => onPointerUp?.call(),
        child: child,
      );
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: child,
      ),
    );
  }
}
