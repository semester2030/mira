import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as im;

import '../../../../shared/theme/colors.dart';
import '../../semantics/metric_presentation_policy.dart';

/// How Perfect RGBA is mapped to presentation alpha (geometry untouched).
enum PerfectMaskAlphaMode {
  /// Keep Perfect alpha; optional linear gain (0 stays 0).
  sourceAlpha,

  /// Spot-like HD masks: Perfect encodes lesions in RGB over a gray wash.
  /// Presentation alpha from luminance above [luminanceGateFloor]; Perfect A=0 → 0.
  luminanceGate,
}

/// Metric-specific presentation calibration for the ONE PerfectMaskOverlay.
@immutable
class PerfectMaskPresentationProfile {
  const PerfectMaskPresentationProfile({
    required this.opacity,
    required this.tintAlpha,
    required this.softPresenceFactor,
    required this.softPresenceCap,
    required this.alphaMode,
    required this.alphaGain,
    required this.luminanceGateFloor,
  });

  final double opacity;
  final double tintAlpha;
  final double softPresenceFactor;
  final double softPresenceCap;
  final PerfectMaskAlphaMode alphaMode;
  final double alphaGain;
  final double luminanceGateFloor;

  /// Default Face Explorer profile — must stay stable for non-calibrated metrics.
  static const PerfectMaskPresentationProfile standard =
      PerfectMaskPresentationProfile(
    opacity: 0.58,
    tintAlpha: 0.96,
    softPresenceFactor: 0.38,
    softPresenceCap: 0.26,
    alphaMode: PerfectMaskAlphaMode.sourceAlpha,
    alphaGain: 1.0,
    luminanceGateFloor: 0,
  );

  /// التصبغات / hd_age_spot — boost lesion salience; suppress gray wash.
  static const PerfectMaskPresentationProfile pigmentation =
      PerfectMaskPresentationProfile(
    opacity: 0.72,
    tintAlpha: 1.0,
    softPresenceFactor: 0.18,
    softPresenceCap: 0.16,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.35,
    luminanceGateFloor: 72,
  );

  /// الحبوب / hd_acne — same encoding family as age_spot; distinct color via tokens.
  static const PerfectMaskPresentationProfile acne =
      PerfectMaskPresentationProfile(
    opacity: 0.74,
    tintAlpha: 1.0,
    softPresenceFactor: 0.16,
    softPresenceCap: 0.15,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.45,
    luminanceGateFloor: 72,
  );

  /// المسام / hd_pore — amplify sparse Perfect signal; suppress gray wash.
  static const PerfectMaskPresentationProfile pores =
      PerfectMaskPresentationProfile(
    opacity: 0.76,
    tintAlpha: 1.0,
    softPresenceFactor: 0.20,
    softPresenceCap: 0.18,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.55,
    luminanceGateFloor: 70,
  );

  /// الدهون / hd_oiliness — orange signal over gray wash (measured).
  static const PerfectMaskPresentationProfile oiliness =
      PerfectMaskPresentationProfile(
    opacity: 0.78,
    tintAlpha: 1.0,
    softPresenceFactor: 0.20,
    softPresenceCap: 0.18,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.55,
    luminanceGateFloor: 68,
  );

  /// التجاعيد / hd_wrinkle — amplify Perfect line pixels only (no redraw).
  static const PerfectMaskPresentationProfile wrinkles =
      PerfectMaskPresentationProfile(
    opacity: 0.82,
    tintAlpha: 1.0,
    softPresenceFactor: 0.24,
    softPresenceCap: 0.22,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.78,
    luminanceGateFloor: 60,
  );

  /// الاحمرار / hd_redness — wash-family → gate for tap-visible response.
  static const PerfectMaskPresentationProfile redness =
      PerfectMaskPresentationProfile(
    opacity: 0.74,
    tintAlpha: 1.0,
    softPresenceFactor: 0.18,
    softPresenceCap: 0.16,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.42,
    luminanceGateFloor: 68,
  );

  /// الملمس / hd_texture.
  static const PerfectMaskPresentationProfile texture =
      PerfectMaskPresentationProfile(
    opacity: 0.72,
    tintAlpha: 1.0,
    softPresenceFactor: 0.18,
    softPresenceCap: 0.16,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.40,
    luminanceGateFloor: 70,
  );

  /// الترطيب / hd_moisture.
  static const PerfectMaskPresentationProfile hydration =
      PerfectMaskPresentationProfile(
    opacity: 0.70,
    tintAlpha: 1.0,
    softPresenceFactor: 0.16,
    softPresenceCap: 0.15,
    alphaMode: PerfectMaskAlphaMode.luminanceGate,
    alphaGain: 1.38,
    luminanceGateFloor: 70,
  );

  double get softPresenceOpacity =>
      (opacity * softPresenceFactor).clamp(0.0, softPresenceCap);
}

/// Design-System tokens for Perfect-mask Face Explorer presentation.
/// Geometry/offset never live here — Perfect alpha is spatial truth.
abstract final class SkinFaceMapVisualTokens {
  SkinFaceMapVisualTokens._();

  static const version =
      'skin-face-map-tokens-v11-mask-visible-pixel-closure';

  /// TEMPORARY high-contrast mask proof for physical iPhone closure.
  /// Set to false after owner confirms visible pixels (do not ship true).
  static const bool maskVisibilityDiagnostic = true;

  static const Color diagnosticMaskTint = Color(0xFFFF00AA);

  static const Color idleFill = Color(0x00000000);

  /// Immersive explorer chrome.
  static const Color explorerBlack = Color(0xFF0A0A0B);
  /// Pure matte stage — exposes halo / leakage (Apple composite target).
  static const Color faceOnlyBlack = Color(0xFF000000);
  static const Color explorerOnBlack = Color(0xFFF5F0F2);
  static const Color explorerOnBlackMuted = Color(0xFFB8AEB2);

  /// Default overlay opacity (non-calibrated metrics).
  static double get maskOverlayOpacity =>
      PerfectMaskPresentationProfile.standard.opacity;

  static PerfectMaskPresentationProfile presentationProfileForConcern(
    String? concernId,
  ) {
    final id = (concernId ?? '').toLowerCase();
    if (id.contains('pigment') ||
        id.contains('age_spot') ||
        id.contains('dark_spot') ||
        (id.contains('spot') && !id.contains('dark_circle')) ||
        id.contains('تصبغ')) {
      return PerfectMaskPresentationProfile.pigmentation;
    }
    if (id.contains('acne') || id.contains('حبوب')) {
      return PerfectMaskPresentationProfile.acne;
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return PerfectMaskPresentationProfile.pores;
    }
    if (id.contains('oil') ||
        id.contains('sebum') ||
        id.contains('دهون') ||
        id.contains('زهم')) {
      return PerfectMaskPresentationProfile.oiliness;
    }
    if (id.contains('wrinkle') || id.contains('تجاعيد')) {
      return PerfectMaskPresentationProfile.wrinkles;
    }
    if (id.contains('redness') || id.contains('احمرار')) {
      return PerfectMaskPresentationProfile.redness;
    }
    if (id.contains('texture') || id.contains('ملمس')) {
      return PerfectMaskPresentationProfile.texture;
    }
    if (id.contains('hydrat') ||
        id.contains('moisture') ||
        id.contains('ترطيب')) {
      return PerfectMaskPresentationProfile.hydration;
    }
    return PerfectMaskPresentationProfile.standard;
  }

  static Color maskTintForConcern(String? concernId) {
    final profile = presentationProfileForConcern(concernId);
    return accentForConcern(concernId).withValues(alpha: profile.tintAlpha);
  }

  /// Subtle atmospheric surface tint for selected metric (never distracts).
  static Color atmosphereForConcern(String? concernId) {
    return accentForConcern(concernId).withValues(alpha: 0.07);
  }

  /// Semantic analysis accents from canonical AppColors only.
  static Color accentForConcern(String? concernId) {
    final id = (concernId ?? '').toLowerCase();
    if (id.contains('oil') ||
        id.contains('sebum') ||
        id.contains('دهون') ||
        id.contains('زهم')) {
      return AppColors.analysisOil;
    }
    if (id.contains('hydrat') ||
        id.contains('moisture') ||
        id.contains('ترطيب')) {
      return AppColors.analysisHydration;
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return AppColors.analysisPores;
    }
    if (id.contains('pigment') || id.contains('spot') || id.contains('تصبغ')) {
      return AppColors.analysisPigmentation;
    }
    if (id.contains('acne') || id.contains('حبوب')) {
      return AppColors.analysisAcne;
    }
    if (id.contains('wrinkle') || id.contains('تجاعيد')) {
      return AppColors.analysisWrinkles;
    }
    if (id.contains('redness') || id.contains('احمرار')) {
      return AppColors.analysisRedness;
    }
    if (id.contains('texture') || id.contains('ملمس')) {
      return AppColors.analysisTexture;
    }
    return AppColors.primary;
  }

  static String polarityLegendAr(String? concernId) {
    return MetricPresentationPolicy.faceExplorerHintAr(concernId ?? '');
  }

  /// Presentation-only alpha from one Perfect RGBA pixel.
  /// Never activates Perfect A=0. Never expands spatial footprint.
  static int presentationAlphaFromPerfectRgba({
    required int r,
    required int g,
    required int b,
    required int a,
    required PerfectMaskPresentationProfile profile,
  }) {
    if (a <= 0) return 0;
    switch (profile.alphaMode) {
      case PerfectMaskAlphaMode.sourceAlpha:
        final gained = a * profile.alphaGain;
        return gained.clamp(0, 255).round();
      case PerfectMaskAlphaMode.luminanceGate:
        final lum = 0.299 * r + 0.587 * g + 0.114 * b;
        final gated = lum - profile.luminanceGateFloor;
        if (gated <= 0) return 0;
        final out = gated * profile.alphaGain * (a / 255.0);
        return out.clamp(0, 255).round();
    }
  }

  /// Informational callout anchor (NOT Perfect geometry).
  static AlignmentDirectional calloutAlignmentForSubregion(String? region) {
    switch ((region ?? 'whole').toLowerCase()) {
      case 'forehead':
      case 'glabellar':
        return AlignmentDirectional.topCenter;
      case 'nose':
        return AlignmentDirectional.center;
      case 'cheek':
        return AlignmentDirectional.centerStart;
      case 'crowfeet':
      case 'periocular':
        return AlignmentDirectional.centerEnd;
      case 'nasolabial':
      case 'marionette':
        return AlignmentDirectional.bottomCenter;
      case 'whole':
      case 'all':
      default:
        return AlignmentDirectional.topEnd;
    }
  }

  static Duration get selectionTransition => const Duration(milliseconds: 180);
  static Duration get metricCrossfade => const Duration(milliseconds: 220);
  static Duration get comparisonSnap => const Duration(milliseconds: 60);
  static Duration get calloutAppear => const Duration(milliseconds: 200);

  /// Deprecated landmark fills — retained for legacy tests only.
  @Deprecated('Consumer Face Explorer uses Perfect masks only')
  static Color selectedFill({
    required String? concernId,
    int? globalScore01to100,
  }) {
    final base = accentForConcern(concernId);
    final t = ((globalScore01to100 ?? 50).clamp(0, 100)) / 100.0;
    final alpha = 0.22 + (0.12 * t);
    return base.withValues(alpha: alpha.clamp(0.22, 0.34));
  }
}

/// Real magnifier focus from Perfect mask pixels only (presentation).
/// Returns null when no non-zero presentation signal exists.
abstract final class PerfectMaskMagnifierFocus {
  PerfectMaskMagnifierFocus._();

  static Alignment? fromMaskBytes({
    required Uint8List bytes,
    required PerfectMaskPresentationProfile profile,
  }) {
    final decoded = im.decodeImage(bytes);
    if (decoded == null || decoded.width <= 0 || decoded.height <= 0) {
      return null;
    }
    final w = decoded.width;
    final h = decoded.height;
    var sx = 0.0;
    var sy = 0.0;
    var n = 0;
    // Stride sample — geometry unchanged; locate real signal only.
    const step = 3;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        final p = decoded.getPixel(x, y);
        final a = p.a.toInt();
        if (a <= 0) continue;
        final present = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: p.r.toInt(),
          g: p.g.toInt(),
          b: p.b.toInt(),
          a: a,
          profile: profile,
        );
        if (present < 36) continue;
        sx += x;
        sy += y;
        n++;
      }
    }
    if (n < 6) return null;
    final nx = (sx / n) / (w - 1);
    final ny = (sy / n) / (h - 1);
    return Alignment(
      (nx * 2) - 1,
      (ny * 2) - 1,
    );
  }

  /// Sanitized sample count of presentation-visible Perfect pixels (stride).
  /// Returns -1 on decode failure; 0 if no signal; >0 if mask has visible signal.
  static int countPresentationSignalSamples({
    required Uint8List bytes,
    required PerfectMaskPresentationProfile profile,
  }) {
    final decoded = im.decodeImage(bytes);
    if (decoded == null || decoded.width <= 0 || decoded.height <= 0) {
      return -1;
    }
    var n = 0;
    const step = 3;
    for (var y = 0; y < decoded.height; y += step) {
      for (var x = 0; x < decoded.width; x += step) {
        final p = decoded.getPixel(x, y);
        final a = p.a.toInt();
        if (a <= 0) continue;
        final present = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: p.r.toInt(),
          g: p.g.toInt(),
          b: p.b.toInt(),
          a: a,
          profile: profile,
        );
        if (present >= 36) n++;
      }
    }
    return n;
  }

  /// Raw Perfect alpha>0 sample count (stride). Decode fail → -1.
  static int countRawNonZeroAlphaSamples(Uint8List bytes) {
    final decoded = im.decodeImage(bytes);
    if (decoded == null || decoded.width <= 0 || decoded.height <= 0) {
      return -1;
    }
    var n = 0;
    const step = 3;
    for (var y = 0; y < decoded.height; y += step) {
      for (var x = 0; x < decoded.width; x += step) {
        if (decoded.getPixel(x, y).a.toInt() > 0) n++;
      }
    }
    return n;
  }
}

/// Illustrative common zones — NOT provider localization (legacy helper).
abstract final class SkinFaceMapEducationalZones {
  SkinFaceMapEducationalZones._();

  static List<String> exploreIdsForConcern(String? concernId) {
    final id = (concernId ?? '').toLowerCase();
    if (id.contains('oil') || id.contains('sebum') || id.contains('دهون')) {
      return const ['forehead', 'nose', 'chin'];
    }
    if (id.contains('hydrat') || id.contains('moisture') || id.contains('ترطيب')) {
      return const ['cheeks_left', 'cheeks_right'];
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return const ['forehead', 'nose', 'chin'];
    }
    return const [];
  }
}
