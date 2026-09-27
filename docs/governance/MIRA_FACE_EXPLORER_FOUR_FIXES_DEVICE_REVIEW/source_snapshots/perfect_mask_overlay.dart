import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../geometry/shared_image_mask_fit.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// ONE production Perfect-mask renderer.
/// Inputs: original face + Perfect mask bytes + presentation profile.
/// Prefer [presentationDecoded] bytes from [PerfectMaskPresentationDecoder]
/// so luminanceGate matches CPU truth (not GPU ColorFilter.matrix).
///
/// Image + mask share ONE destination rect derived from the **source** pixel
/// grid (BoxFit.contain). Masks of different intrinsic size are forced into
/// that same rect — never independently letterboxed.
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

    /// Intrinsic source size. When null, decoded once via [FutureBuilder].
    this.sourceWidth,
    this.sourceHeight,
    this.fadeDuration = const Duration(milliseconds: 260),
    this.profile = PerfectMaskPresentationProfile.standard,
    this.forceDiagnosticTint = false,

    /// When true, [maskBytes] already carry presentation alpha (CPU remapped).
    this.presentationDecoded = false,
  });

  final Uint8List sourceBytes;
  final Uint8List? maskBytes;
  final Color tint;
  final double opacity;
  final bool showOriginalOnly;
  final bool showMaskOnly;
  final bool applyTint;
  final BoxFit fit;
  final int? sourceWidth;
  final int? sourceHeight;
  final Duration fadeDuration;
  final PerfectMaskPresentationProfile profile;

  /// Temporary high-contrast proof (magenta srcIn). Must stay false in production.
  final bool forceDiagnosticTint;

  /// Mask is already Perfect→presentation remapped (same pixel grid).
  final bool presentationDecoded;

  // Decode the semantic mask first, then filter its coverage for display.
  // Nearest-neighbour downscaling can discard thin paths between samples.
  // Keep the raw fallback unchanged; never filter raw RGB before its gate.
  FilterQuality get _maskFilterQuality =>
      presentationDecoded ? FilterQuality.medium : FilterQuality.none;

  @override
  Widget build(BuildContext context) {
    final w = sourceWidth;
    final h = sourceHeight;
    if (w != null && h != null && w > 0 && h > 0) {
      return _buildWithSize(Size(w.toDouble(), h.toDouble()));
    }
    return FutureBuilder<Size?>(
      future: _decodeSize(sourceBytes),
      builder: (context, snap) {
        final size = snap.data;
        if (size == null || size.width <= 0 || size.height <= 0) {
          return const SizedBox.expand();
        }
        return _buildWithSize(size);
      },
    );
  }

  Widget _buildWithSize(Size sourceSize) {
    final hasMask = maskBytes != null && maskBytes!.isNotEmpty;
    final diagnostic =
        forceDiagnosticTint && SkinFaceMapVisualTokens.maskVisibilityDiagnostic;
    final effectiveOpacity = diagnostic ? 1.0 : opacity.clamp(0.0, 1.0);
    final softOpacity = diagnostic ? 0.0 : profile.softPresenceOpacity;
    assert(() {
      if (hasMask && !showOriginalOnly && kDebugMode) {
        debugPrint(
          'PERFECT_MASK_OVERLAY_BUILD hasMask=true '
          'opacity=$effectiveOpacity decoded=$presentationDecoded '
          'src=${sourceSize.width.toInt()}x${sourceSize.height.toInt()} '
          'fit=$fit sharedGrid=1',
        );
      }
      return true;
    }());

    final ar = sourceSize.width / sourceSize.height;
    return AspectRatio(
      aspectRatio: ar.isFinite && ar > 0 ? ar : (3 / 4),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final viewport = Size(constraints.maxWidth, constraints.maxHeight);
          if (viewport.width <= 0 || viewport.height <= 0) {
            return const SizedBox.shrink();
          }

          final dest = switch (fit) {
            BoxFit.cover => SharedImageMaskFit.coverRect(
              viewport: viewport,
              sourceSize: sourceSize,
            ),
            BoxFit.fill => SharedImageMaskFit.fillRect(viewport: viewport),
            _ => SharedImageMaskFit.containRect(
              viewport: viewport,
              sourceSize: sourceSize,
            ),
          };

          Widget positionedImage(Uint8List bytes, {required bool isMask}) {
            return Positioned.fromRect(
              rect: dest,
              child: Image.memory(
                bytes,
                fit: BoxFit.fill,
                width: dest.width,
                height: dest.height,
                gaplessPlayback: true,
                filterQuality: isMask ? _maskFilterQuality : FilterQuality.high,
              ),
            );
          }

          Widget positionedTinted(
            Uint8List bytes, {
            required double opacity,
            required bool diagnostic,
          }) {
            return Positioned.fromRect(
              rect: dest,
              child: AnimatedOpacity(
                opacity: opacity,
                duration: fadeDuration,
                curve: Curves.easeOutCubic,
                child: _tintedMask(
                  bytes,
                  width: dest.width,
                  height: dest.height,
                  diagnostic: diagnostic,
                ),
              ),
            );
          }

          return ClipRect(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (!showMaskOnly) positionedImage(sourceBytes, isMask: false),
                if (!showOriginalOnly && hasMask)
                  KeyedSubtree(
                    key: ValueKey<Object>(
                      Object.hash(
                        maskBytes!.length,
                        tint.toARGB32(),
                        showMaskOnly,
                        diagnostic,
                        presentationDecoded,
                        profile.alphaMode,
                        profile.alphaGain,
                        profile.luminanceGateFloor,
                        dest.width.round(),
                        dest.height.round(),
                      ),
                    ),
                    child: applyTint || diagnostic
                        ? positionedTinted(
                            maskBytes!,
                            opacity: effectiveOpacity,
                            diagnostic: diagnostic,
                          )
                        : Positioned.fromRect(
                            rect: dest,
                            child: AnimatedOpacity(
                              opacity: effectiveOpacity,
                              duration: fadeDuration,
                              curve: Curves.easeOutCubic,
                              child: Image.memory(
                                maskBytes!,
                                fit: BoxFit.fill,
                                width: dest.width,
                                height: dest.height,
                                gaplessPlayback: true,
                                filterQuality: _maskFilterQuality,
                              ),
                            ),
                          ),
                  ),
                if (!showOriginalOnly &&
                    !showMaskOnly &&
                    applyTint &&
                    !diagnostic &&
                    hasMask &&
                    softOpacity > 0)
                  positionedTinted(
                    maskBytes!,
                    opacity: softOpacity,
                    diagnostic: false,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _tintedMask(
    Uint8List bytes, {
    required double width,
    required double height,
    required bool diagnostic,
  }) {
    Widget child = Image.memory(
      bytes,
      fit: BoxFit.fill,
      width: width,
      height: height,
      gaplessPlayback: true,
      filterQuality: _maskFilterQuality,
    );

    if (diagnostic) {
      return ColorFiltered(
        colorFilter: const ColorFilter.mode(
          SkinFaceMapVisualTokens.diagnosticMaskTint,
          BlendMode.srcIn,
        ),
        child: child,
      );
    }

    // CPU-remapped presentation PNGs already hold correct alpha — srcIn only.
    if (!presentationDecoded &&
        (profile.alphaMode == PerfectMaskAlphaMode.luminanceGate ||
            profile.alphaGain != 1.0)) {
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

  static Future<Size?> _decodeSize(Uint8List bytes) async {
    try {
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      final size = Size(
        frame.image.width.toDouble(),
        frame.image.height.toDouble(),
      );
      frame.image.dispose();
      return size;
    } catch (_) {
      return null;
    }
  }

  /// Legacy GPU path — retained for tests / non-remapped fallback only.
  static List<double> _presentationAlphaMatrix(
    PerfectMaskPresentationProfile profile,
  ) {
    if (profile.alphaMode == PerfectMaskAlphaMode.luminanceGate) {
      final g = profile.alphaGain;
      final floorN = profile.luminanceGateFloor / 255.0;
      return <double>[
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0.299 * g,
        0.587 * g,
        0.114 * g,
        0,
        -floorN * g,
      ];
    }
    final g = profile.alphaGain;
    return <double>[0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, g, 0];
  }

  @visibleForTesting
  static List<double> debugPresentationAlphaMatrix(
    PerfectMaskPresentationProfile profile,
  ) => _presentationAlphaMatrix(profile);
}
