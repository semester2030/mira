import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../geometry/skin_face_map_visual_tokens.dart';

/// ONE production Perfect-mask renderer.
/// Inputs: original face + Perfect alpha mask + presentation profile.
/// Does NOT call Perfect, parse JSON, construct landmarks, or draw strokes.
class PerfectMaskOverlay extends StatelessWidget {
  const PerfectMaskOverlay({
    super.key,
    required this.sourceBytes,
    this.maskBytes,
    required this.tint,
    this.opacity = 0.58,
    this.showOriginalOnly = false,
    this.showMaskOnly = false,
    this.applyTint = true,
    this.fit = BoxFit.contain,
    this.aspectRatio = 1200 / 1680,
    this.fadeDuration = const Duration(milliseconds: 260),
    this.profile = PerfectMaskPresentationProfile.standard,
    this.forceDiagnosticTint = false,
  });

  final Uint8List sourceBytes;
  final Uint8List? maskBytes;
  final Color tint;
  final double opacity;
  final bool showOriginalOnly;
  final bool showMaskOnly;
  final bool applyTint;
  final BoxFit fit;
  final double aspectRatio;
  final Duration fadeDuration;
  final PerfectMaskPresentationProfile profile;

  /// Temporary high-contrast proof (magenta srcIn). Must stay false in production.
  final bool forceDiagnosticTint;

  @override
  Widget build(BuildContext context) {
    final hasMask = maskBytes != null && maskBytes!.isNotEmpty;
    final diagnostic = forceDiagnosticTint ||
        SkinFaceMapVisualTokens.maskVisibilityDiagnostic;
    final effectiveOpacity = diagnostic ? 1.0 : opacity.clamp(0.0, 1.0);
    final softOpacity = diagnostic ? 0.0 : profile.softPresenceOpacity;
    // Always print (not assert-only) so profile installs prove build executed.
    if (kDebugMode || SkinFaceMapVisualTokens.maskVisibilityDiagnostic) {
      if (hasMask && !showOriginalOnly) {
        final t = diagnostic
            ? SkinFaceMapVisualTokens.diagnosticMaskTint
            : tint;
        debugPrint(
          'PERFECT_MASK_OVERLAY_BUILD hasMask=true '
          'showMaskOnly=$showMaskOnly diagnostic=$diagnostic '
          'opacity=$effectiveOpacity bytes=${maskBytes!.length} '
          'tint=0x${t.toARGB32().toRadixString(16)} '
          'layer=MASK_ABOVE_SUBJECT',
        );
      }
    }
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: ClipRect(
        child: Stack(
          fit: StackFit.expand,
          children: [
            // LAYER: subject (Apple-matted face or original) — omitted when mask-only.
            if (!showMaskOnly)
              Image.memory(
                sourceBytes,
                fit: fit,
                gaplessPlayback: true,
                filterQuality: FilterQuality.high,
              ),
            // LAYER: Perfect mask ABOVE subject.
            if (!showOriginalOnly && hasMask)
              AnimatedOpacity(
                key: ValueKey<Object>(
                  Object.hash(
                    maskBytes!.length,
                    tint.toARGB32(),
                    showMaskOnly,
                    diagnostic,
                    profile.alphaMode,
                    profile.alphaGain,
                    profile.luminanceGateFloor,
                  ),
                ),
                opacity: effectiveOpacity,
                duration: fadeDuration,
                curve: Curves.easeOutCubic,
                // applyTint must work for showMaskOnly (explicit layer stacks).
                child: applyTint || diagnostic
                    ? _tintedMask(maskBytes!, diagnostic: diagnostic)
                    : Image.memory(
                        maskBytes!,
                        fit: fit,
                        gaplessPlayback: true,
                        filterQuality: FilterQuality.high,
                      ),
              ),
            if (!showOriginalOnly &&
                !showMaskOnly &&
                applyTint &&
                !diagnostic &&
                hasMask &&
                softOpacity > 0)
              AnimatedOpacity(
                opacity: softOpacity,
                duration: fadeDuration,
                curve: Curves.easeOutCubic,
                child: _tintedMask(maskBytes!, diagnostic: false),
              ),
          ],
        ),
      ),
    );
  }

  Widget _tintedMask(Uint8List bytes, {required bool diagnostic}) {
    Widget child = Image.memory(
      bytes,
      fit: fit,
      gaplessPlayback: true,
      filterQuality: FilterQuality.high,
    );

    if (diagnostic) {
      // High-contrast proof ONLY — geometry untouched.
      // Use Perfect source alpha (no luminance gate) so gray-wash HD masks
      // (A≈90 face-wide) paint solid magenta above Apple matte.
      return ColorFiltered(
        colorFilter: const ColorFilter.mode(
          SkinFaceMapVisualTokens.diagnosticMaskTint,
          BlendMode.srcIn,
        ),
        child: child,
      );
    }

    if (profile.alphaMode == PerfectMaskAlphaMode.luminanceGate ||
        profile.alphaGain != 1.0) {
      child = ColorFiltered(
        colorFilter: ColorFilter.matrix(_presentationAlphaMatrix(profile)),
        child: child,
      );
    }

    return ColorFiltered(
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
      child: child,
    );
  }

  /// Flutter [ColorFilter.matrix] is 0.0–1.0 space.
  /// Force RGB→1 so srcIn uses remapped alpha only (clean tint).
  static List<double> _presentationAlphaMatrix(
    PerfectMaskPresentationProfile profile,
  ) {
    if (profile.alphaMode == PerfectMaskAlphaMode.luminanceGate) {
      final g = profile.alphaGain;
      final floorN = profile.luminanceGateFloor / 255.0;
      return <double>[
        0, 0, 0, 0, 1,
        0, 0, 0, 0, 1,
        0, 0, 0, 0, 1,
        0.299 * g, 0.587 * g, 0.114 * g, 0, -floorN * g,
      ];
    }
    final g = profile.alphaGain;
    return <double>[
      0, 0, 0, 0, 1,
      0, 0, 0, 0, 1,
      0, 0, 0, 0, 1,
      0, 0, 0, g, 0,
    ];
  }

  @visibleForTesting
  static List<double> debugPresentationAlphaMatrix(
    PerfectMaskPresentationProfile profile,
  ) =>
      _presentationAlphaMatrix(profile);
}
