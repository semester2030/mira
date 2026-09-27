import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/spacing.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/perfect_mask_presentation_decoder.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import 'perfect_mask_overlay.dart';

/// Temporary local 4-pane compare — OFF unless
/// [SkinFaceMapVisualTokens.alignmentDiagnosticCompare] is true.
/// Never ships face pixels to network; never for History.
class PerfectMaskAlignmentDiagnostic extends StatelessWidget {
  const PerfectMaskAlignmentDiagnostic({
    super.key,
    required this.sourceBytes,
    required this.rawMaskBytes,
    required this.tint,
    required this.profile,
    this.sourceWidth,
    this.sourceHeight,
  });

  final Uint8List sourceBytes;
  final Uint8List rawMaskBytes;
  final Color tint;
  final PerfectMaskPresentationProfile profile;
  final int? sourceWidth;
  final int? sourceHeight;

  @override
  Widget build(BuildContext context) {
    if (!SkinFaceMapVisualTokens.alignmentDiagnosticCompare) {
      return const SizedBox.shrink();
    }
    final remapped = PerfectMaskPresentationDecoder.remapToPresentationPng(
      perfectPngBytes: rawMaskBytes,
      profile: profile,
    );
    final audit = PerfectMaskPresentationDecoder.audit(
      perfectPngBytes: rawMaskBytes,
      profile: profile,
      step: 4,
    );

    Widget pane(String label, Widget child) {
      return Expanded(
        child: Column(
          children: [
            Text(
              label,
              style: AppTypography.labelSmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            AspectRatio(
              aspectRatio: 3 / 4,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: ColoredBox(
                  color: SkinFaceMapVisualTokens.faceOnlyBlack,
                  child: child,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'تشخيص محاذاة (محلي)',
            style: AppTypography.labelMedium.copyWith(
              color: AppColors.warning,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          if (audit != null)
            Text(
              'mask=${audit.width}x${audit.height} '
              'α>0=${audit.nonzeroAlphaCount} '
              'pres=${audit.presentationNonzeroCount} '
              'maxLum=${audit.maxLuminance}',
              style: AppTypography.labelSmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              pane('A مرجع', Image.memory(sourceBytes, fit: BoxFit.contain)),
              const SizedBox(width: 6),
              pane(
                'B أصل القناع',
                Image.memory(rawMaskBytes, fit: BoxFit.contain),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              pane(
                'C هندسة مشتركة',
                PerfectMaskOverlay(
                  sourceBytes: sourceBytes,
                  maskBytes: remapped ?? rawMaskBytes,
                  tint: tint,
                  profile: profile,
                  presentationDecoded: remapped != null,
                  sourceWidth: sourceWidth,
                  sourceHeight: sourceHeight,
                  opacity: 0.85,
                  fadeDuration: Duration.zero,
                ),
              ),
              const SizedBox(width: 6),
              pane(
                'D إنتاج',
                PerfectMaskOverlay(
                  sourceBytes: sourceBytes,
                  maskBytes: remapped ?? rawMaskBytes,
                  tint: tint,
                  profile: profile,
                  presentationDecoded: remapped != null,
                  sourceWidth: sourceWidth,
                  sourceHeight: sourceHeight,
                  opacity: profile.opacity,
                  fadeDuration: Duration.zero,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
