import 'dart:ui';

/// Perfect HD mask ↔ analysis-source coordinate contract (presentation).
///
/// Evidence (sanitized real materialization, source 1200×1680):
/// every `hd_*` concern PNG matched source W×H with
/// `alignedWithSource=true` / notes «mask dimensions == source (offset 0)».
/// Masks are full-frame overlays of the uploaded analysis image — not ROI crops
/// and not landmark polygons. Encoding: PNG with alpha; signal often in RGB
/// luminance over a gray wash (see [PerfectMaskPresentationDecoder]).
enum MaskSourceAlignmentMode {
  /// Mask W×H == source W×H (or same aspect + proven full-frame). Uniform map.
  fullFrameAligned,

  /// Same aspect ratio, different resolution — uniform scale into source grid.
  fullFrameResampled,

  /// Aspect mismatch or missing dims — do NOT distort with BoxFit.fill.
  unknownIncompatible,
}

class MaskSourceAlignmentDecision {
  const MaskSourceAlignmentDecision({
    required this.mode,
    required this.mayOverlaySpatially,
    required this.notes,
  });

  final MaskSourceAlignmentMode mode;
  final bool mayOverlaySpatially;
  final String notes;
}

abstract final class MaskSourceAlignmentContract {
  MaskSourceAlignmentContract._();

  /// Aspect tolerance for treating mask as same FOV at different resolution.
  static const aspectEpsilon = 0.02;

  static MaskSourceAlignmentDecision decide({
    required int? sourceWidth,
    required int? sourceHeight,
    required int? maskWidth,
    required int? maskHeight,
    bool? alignedWithSource,
  }) {
    if (sourceWidth == null ||
        sourceHeight == null ||
        sourceWidth <= 0 ||
        sourceHeight <= 0) {
      return const MaskSourceAlignmentDecision(
        mode: MaskSourceAlignmentMode.unknownIncompatible,
        mayOverlaySpatially: false,
        notes: 'source dims missing',
      );
    }
    if (maskWidth == null ||
        maskHeight == null ||
        maskWidth <= 0 ||
        maskHeight <= 0) {
      return const MaskSourceAlignmentDecision(
        mode: MaskSourceAlignmentMode.unknownIncompatible,
        mayOverlaySpatially: false,
        notes: 'mask dims missing',
      );
    }

    if (alignedWithSource == true ||
        (maskWidth == sourceWidth && maskHeight == sourceHeight)) {
      return const MaskSourceAlignmentDecision(
        mode: MaskSourceAlignmentMode.fullFrameAligned,
        mayOverlaySpatially: true,
        notes: 'mask grid == source grid (0 offset)',
      );
    }

    final srcAr = sourceWidth / sourceHeight;
    final maskAr = maskWidth / maskHeight;
    if ((srcAr - maskAr).abs() <= aspectEpsilon) {
      return MaskSourceAlignmentDecision(
        mode: MaskSourceAlignmentMode.fullFrameResampled,
        mayOverlaySpatially: true,
        notes:
            'same aspect; uniform scale mask ${maskWidth}x$maskHeight → '
            'source ${sourceWidth}x$sourceHeight (Perfect full-frame assumption)',
      );
    }

    return MaskSourceAlignmentDecision(
      mode: MaskSourceAlignmentMode.unknownIncompatible,
      mayOverlaySpatially: false,
      notes:
          'aspect mismatch mask=${maskWidth}x$maskHeight '
          'source=${sourceWidth}x$sourceHeight — refuse distorting fill',
    );
  }

  /// Destination rect for photo+mask under [BoxFit.contain] (production).
  static Rect sharedContainDest({
    required Size viewport,
    required Size sourceSize,
  }) {
    // Delegated — kept here for contract documentation of the chain:
    // mask pixels → source pixels (1:1 or uniform) → contain(viewport).
    final scale = _min(
      viewport.width / sourceSize.width,
      viewport.height / sourceSize.height,
    );
    final w = sourceSize.width * scale;
    final h = sourceSize.height * scale;
    return Rect.fromLTWH(
      (viewport.width - w) / 2,
      (viewport.height - h) / 2,
      w,
      h,
    );
  }

  static double _min(double a, double b) => a < b ? a : b;
}
