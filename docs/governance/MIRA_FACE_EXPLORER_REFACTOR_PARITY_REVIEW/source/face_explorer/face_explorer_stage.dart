import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/spacing.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/face_map_overlay_decision.dart';
import '../../domain/perfect_mask_session.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../geometry/shared_image_mask_fit.dart';
import '../geometry/skin_face_explorer_layer_isolation.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import '../widgets/perfect_mask_overlay.dart';
import '../widgets/perfect_mask_region_callout.dart';

/// Face photo + Perfect mask stage with image-local tap mapping.
class FaceExplorerStage extends StatefulWidget {
  const FaceExplorerStage({
    super.key,
    required this.displayBytes,
    required this.sourceWidth,
    required this.sourceHeight,
    required this.session,
    required this.selectedId,
    required this.decision,
    required this.holdingOriginal,
    required this.lensPanelOpen,
    required this.focusSourceNorm,
    required this.onTapSourceNorm,
    required this.onOpenLens,
  });

  final Uint8List displayBytes;
  final int? sourceWidth;
  final int? sourceHeight;
  final PerfectMaskSession? session;
  final String? selectedId;
  final FaceMapOverlayDecision decision;
  final bool holdingOriginal;
  final bool lensPanelOpen;
  final Offset? focusSourceNorm;
  final ValueChanged<Offset> onTapSourceNorm;
  final VoidCallback onOpenLens;

  @override
  State<FaceExplorerStage> createState() => _FaceExplorerStageState();
}

class _FaceExplorerStageState extends State<FaceExplorerStage> {
  final GlobalKey _imageKey = GlobalKey(debugLabel: 'faceExplorerStageImage');
  Size? _viewportSize;

  void _onTapDown(TapDownDetails details) {
    final srcW = widget.sourceWidth;
    final srcH = widget.sourceHeight;
    final box = _imageKey.currentContext?.findRenderObject() as RenderBox?;
    if (srcW == null || srcH == null || box == null || srcW <= 0 || srcH <= 0) {
      return;
    }
    final vp = box.size;
    final norm = SharedImageMaskFit.viewportToSourceNorm(
      viewport: vp,
      sourceSize: Size(srcW.toDouble(), srcH.toDouble()),
      viewportPoint: details.localPosition,
    );
    if (norm == null) return;
    HapticFeedback.selectionClick();
    setState(() => _viewportSize = vp);
    widget.onTapSourceNorm(norm);
    if (!widget.lensPanelOpen) widget.onOpenLens();
  }

  @override
  Widget build(BuildContext context) {
    final overlay = widget.decision;
    final mask = overlay.boundArtifact;
    final showAnalysis = overlay.showSpatialOverlay;
    final selected = widget.selectedId;
    final profile =
        SkinFaceMapVisualTokens.presentationProfileForConcern(selected);
    final tint = SkinFaceMapVisualTokens.maskTintForConcern(selected);
    final region = mask?.region ?? 'whole';
    final regionStrict = region != 'whole' && region != 'all';
    final showRegionCallout = showAnalysis && regionStrict;
    final calloutAlign =
        SkinFaceMapVisualTokens.calloutAlignmentForSubregion(region);
    final label = selected == null
        ? 'وجهك الأصلي'
        : MetricPresentationPolicy.publicLabelAr(selected);

    final remappedMaskBytes = (showAnalysis &&
            mask != null &&
            widget.session != null &&
            mask.bytes != null &&
            mask.bytes!.isNotEmpty)
        ? widget.session!
            .presentationBytesFor(artifact: mask, profile: profile)
        : null;
    final overlayMaskBytes =
        showAnalysis ? (remappedMaskBytes ?? mask?.bytes) : null;
    final presentationDecoded = remappedMaskBytes != null;
    final showSubject = SkinFaceExplorerLayerIsolation.showSubject;

    final srcSize = (widget.sourceWidth != null &&
            widget.sourceHeight != null &&
            widget.sourceWidth! > 0 &&
            widget.sourceHeight! > 0)
        ? Size(
            widget.sourceWidth!.toDouble(),
            widget.sourceHeight!.toDouble(),
          )
        : null;
    final stageVp = _viewportSize;
    final focusAlign = (widget.focusSourceNorm != null &&
            stageVp != null &&
            srcSize != null)
        ? SharedImageMaskFit.sourceNormToViewportAlignment(
            viewport: stageVp,
            sourceSize: srcSize,
            sourceNorm01: widget.focusSourceNorm!,
          )
        : null;
    final showFocusRing = widget.lensPanelOpen &&
        showAnalysis &&
        focusAlign != null &&
        !widget.holdingOriginal;

    return Semantics(
      label: label,
      button: selected != null,
      child: Column(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 285),
              child: GestureDetector(
                key: _imageKey,
                behavior: HitTestBehavior.opaque,
                onTapDown: showAnalysis ? _onTapDown : null,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final next = Size(
                      constraints.maxWidth,
                      constraints.maxWidth * (450 / 337),
                    );
                    if (_viewportSize != next) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && _viewportSize != next) {
                          setState(() => _viewportSize = next);
                        }
                      });
                    }
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: ColoredBox(
                        color: SkinFaceMapVisualTokens.explorerStage,
                        child: AspectRatio(
                          aspectRatio: 337 / 450,
                          child: Stack(
                            fit: StackFit.passthrough,
                            children: [
                              PerfectMaskOverlay(
                                key: ValueKey<Object>(
                                  Object.hash(
                                    widget.displayBytes.length,
                                    mask?.key,
                                    overlayMaskBytes?.length,
                                    selected,
                                    widget.holdingOriginal,
                                    presentationDecoded,
                                    showAnalysis,
                                    profile.luminanceGateFloor,
                                    profile.alphaGain,
                                    widget.sourceWidth,
                                    widget.sourceHeight,
                                  ),
                                ),
                                sourceBytes: widget.displayBytes,
                                maskBytes: overlayMaskBytes,
                                tint: tint,
                                profile: profile,
                                presentationDecoded: presentationDecoded,
                                sourceWidth: widget.sourceWidth,
                                sourceHeight: widget.sourceHeight,
                                showOriginalOnly: !showAnalysis,
                                showMaskOnly: !showSubject && showAnalysis,
                                applyTint: true,
                                opacity: profile.opacity,
                                fadeDuration: widget.holdingOriginal
                                    ? SkinFaceMapVisualTokens.comparisonSnap
                                    : SkinFaceMapVisualTokens.metricCrossfade,
                              ),
                              if (showRegionCallout &&
                                  selected != null &&
                                  mask != null &&
                                  SkinFaceExplorerLayerIsolation
                                      .showMagnifierCallout)
                                Positioned.fill(
                                  child: Align(
                                    alignment: calloutAlign,
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        textDirection: TextDirection.rtl,
                                        children: [
                                          PerfectMaskCalloutConnector(
                                            accent: tint,
                                          ),
                                          PerfectMaskRegionCallout(
                                            regionLabelAr:
                                                MetricPresentationPolicy
                                                    .subregionLabelAr(region),
                                            metricLabelAr:
                                                MetricPresentationPolicy
                                                    .publicLabelAr(selected),
                                            accent: tint,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              if (widget.holdingOriginal)
                                const Positioned(
                                  right: 14,
                                  top: 14,
                                  child: _StagePill(
                                    label: 'الأصل',
                                    accent: AppColors.textSecondary,
                                  ),
                                ),
                              if (showFocusRing)
                                IgnorePointer(
                                  child: Align(
                                    alignment: focusAlign,
                                    child: Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.white,
                                          width: 2,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: tint,
                                            blurRadius: 0,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                      child: Center(
                                        child: Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: tint,
                                              width: 1,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
          if (overlay.unavailable && selected != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'التعيين غير متاح لهذا المؤشر حالياً.',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.warning,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          if (overlay.scoreOnly && selected != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              overlay.alignmentBlocked
                  ? 'خريطة المزود غير متوافقة هندسيًا مع صورة التحليل — الدرجة فقط دون تمديد مشوّه.'
                  : 'لا يتوفر تحديد مكاني لهذا المؤشر — الدرجة من التحليل فقط دون خريطة.',
              style: AppTypography.labelSmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          if (selected != null && overlay.regionMismatch) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'لا يتوفر قناع مكاني خاص بهذه المنطقة — لم نعرض خريطة الوجه كاملة مكانها.',
              style: AppTypography.labelSmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}

class _StagePill extends StatelessWidget {
  const _StagePill({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.analysisCalloutSurface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          fontWeight: FontWeight.w800,
          color: accent,
        ),
      ),
    );
  }
}
