import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as im;

import '../../../../shared/theme/colors.dart';
import '../../domain/face_map_overlay_decision.dart';
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
    this.minVisibleAlpha = 0,
  });

  final double opacity;
  final double tintAlpha;
  final double softPresenceFactor;
  final double softPresenceCap;
  final PerfectMaskAlphaMode alphaMode;
  final double alphaGain;
  final double luminanceGateFloor;

  /// When presentation alpha is already >0, raise to at least this (no dilation).
  /// Clarifies sparse Perfect cores without expanding footprint into wash.
  final int minVisibleAlpha;

  /// Default Face Explorer profile — Perfect source alpha; no soft double-paint.
  static const PerfectMaskPresentationProfile standard =
      PerfectMaskPresentationProfile(
        opacity: 0.58,
        tintAlpha: 0.96,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.sourceAlpha,
        alphaGain: 1.0,
        luminanceGateFloor: 0,
      );

  /// التصبغات / hd_age_spot — sparse lesions; keep clear, avoid face paint.
  static const PerfectMaskPresentationProfile pigmentation =
      PerfectMaskPresentationProfile(
        opacity: 0.82,
        tintAlpha: 0.98,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.65,
        luminanceGateFloor: 64,
        minVisibleAlpha: 150,
      );

  /// الحبوب / hd_acne — sparse lesions; strong local marks, wash killed.
  static const PerfectMaskPresentationProfile acne =
      PerfectMaskPresentationProfile(
        opacity: 0.88,
        tintAlpha: 0.98,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.90,
        luminanceGateFloor: 64,
        minVisibleAlpha: 165,
      );

  /// المسام / hd_pore — sparse Perfect signal; strong local, no wash paint.
  /// Floor stays above Perfect gray wash (~61) so minVisibleAlpha cannot
  /// resurrect inactive face paint while mid cores (~78+) remain.
  static const PerfectMaskPresentationProfile pores =
      PerfectMaskPresentationProfile(
        opacity: 0.88,
        tintAlpha: 0.99,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 2.15,
        luminanceGateFloor: 62,
        minVisibleAlpha: 168,
      );

  /// الدهون / hd_oiliness — amber area; clearer edges, skin still visible.
  static const PerfectMaskPresentationProfile oiliness =
      PerfectMaskPresentationProfile(
        opacity: 0.72,
        tintAlpha: 0.98,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.90,
        luminanceGateFloor: 62,
        minVisibleAlpha: 120,
      );

  /// التجاعيد / hd_wrinkle — thin path cores; separate from zone borders.
  /// Floor above wash (~61) and below mid strokes (~78) so natural-size
  /// lines stay without face-wide paint when minVisibleAlpha is applied.
  static const PerfectMaskPresentationProfile wrinkles =
      PerfectMaskPresentationProfile(
        opacity: 0.84,
        tintAlpha: 0.99,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 2.00,
        luminanceGateFloor: 62,
        minVisibleAlpha: 160,
      );

  /// الاحمرار / hd_redness — broad wash-family; soft highlight, not paint.
  static const PerfectMaskPresentationProfile redness =
      PerfectMaskPresentationProfile(
        opacity: 0.58,
        tintAlpha: 0.90,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.40,
        luminanceGateFloor: 68,
      );

  /// الملمس / hd_texture — broad; soft, skin-dominant.
  static const PerfectMaskPresentationProfile texture =
      PerfectMaskPresentationProfile(
        opacity: 0.58,
        tintAlpha: 0.90,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.40,
        luminanceGateFloor: 68,
      );

  /// الترطيب / hd_moisture — area tint readable without opaque face paint.
  static const PerfectMaskPresentationProfile hydration =
      PerfectMaskPresentationProfile(
        opacity: 0.66,
        tintAlpha: 0.92,
        softPresenceFactor: 0.0,
        softPresenceCap: 0.0,
        alphaMode: PerfectMaskAlphaMode.luminanceGate,
        alphaGain: 1.55,
        luminanceGateFloor: 66,
      );

  double get softPresenceOpacity =>
      (opacity * softPresenceFactor).clamp(0.0, softPresenceCap);
}

/// Design-System tokens for Perfect-mask Face Explorer presentation.
/// Geometry/offset never live here — Perfect alpha is spatial truth.
abstract final class SkinFaceMapVisualTokens {
  SkinFaceMapVisualTokens._();

  static const version =
      'skin-face-map-tokens-v19-visual-parity-layout-clarity-tune';

  /// Production: diagnostic magenta / DIAG HUD must stay false.
  static const bool maskVisibilityDiagnostic = false;

  /// Local-only 4-pane alignment compare (raw / decoded / stage). Keep false.
  static const bool alignmentDiagnosticCompare = false;

  static const Color diagnosticMaskTint = Color(0xFFFF00AA);

  static const Color idleFill = Color(0x00000000);

  /// Immersive explorer chrome — Mist Blush (AppColors.background).
  static const Color explorerStage = Color(0xFFFFF7FA);

  /// @Deprecated diagnostic pure black — halo leakage checks only.
  static const Color faceOnlyBlack = Color(0xFF000000);
  static const Color explorerOnStage = Color(0xFF4A3A3A);
  static const Color explorerOnStageMuted = Color(0xFF6D5C5C);

  /// Legacy aliases (pre–Mist Blush). Prefer explorerOnStage*.
  static const Color explorerBlack = explorerStage;
  static const Color explorerOnBlack = explorerOnStage;
  static const Color explorerOnBlackMuted = explorerOnStageMuted;

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
    if (id.contains('radiance') ||
        id.contains('إشراق') ||
        id.contains('اشراق')) {
      return AppColors.analysisRadiance;
    }
    if (id.contains('dark_circle') || id.contains('هالات')) {
      return AppColors.analysisDarkCircle;
    }
    if (id.contains('eye_bag') || id.contains('انتفاخ')) {
      return AppColors.analysisEyeBag;
    }
    if (id.contains('droopy_upper') || id.contains('جفن علوي')) {
      return AppColors.analysisDroopyUpper;
    }
    if (id.contains('droopy_lower') || id.contains('جفن سفلي')) {
      return AppColors.analysisDroopyLower;
    }
    return AppColors.primary;
  }

  static String polarityLegendAr(String? concernId) {
    return MetricPresentationPolicy.faceExplorerHintAr(concernId ?? '');
  }

  /// Short legend for Face Explorer — wording matches actual data kind shown.
  static String mapLegendAr(
    String? concernId, {
    PerfectMaskMapDataKind? dataKind,
    bool spatialVisible = true,
  }) {
    final kind =
        dataKind ??
        classifyMapDataKind(
          consumerMetricId: concernId,
          hasMaskBytes: spatialVisible,
          hasScore: !spatialVisible,
          regionRequested: false,
          regionMaskBound: true,
        );
    if (!spatialVisible) {
      switch (kind) {
        case PerfectMaskMapDataKind.scoreOnly:
          return 'لا خريطة مكانية — الدرجة من التحليل فقط';
        case PerfectMaskMapDataKind.regionMaskAbsent:
          return 'لا قناع خاص بهذه المنطقة — لم يُعرض قناع الوجه كله بديلًا';
        case PerfectMaskMapDataKind.unavailable:
          return 'التعيين غير متاح لهذا المؤشر حالياً';
        case PerfectMaskMapDataKind.measurementRegionBoundary:
          return 'حدود منطقة قياس من المزود — ليست نتائج مكتشفة';
        case PerfectMaskMapDataKind.undetermined:
          return 'خريطة مكانية غير مصنّفة في العقد — لا يُدعى نوع رسم محدد';
        case PerfectMaskMapDataKind.discoveredPaths:
        case PerfectMaskMapDataKind.discoveredPoints:
        case PerfectMaskMapDataKind.intensityAreaMask:
          return polarityLegendAr(concernId);
      }
    }
    switch (kind) {
      case PerfectMaskMapDataKind.discoveredPaths:
        return 'الخطوط الخضراء = مسارات التجاعيد من قناع التحليل على صورتك';
      case PerfectMaskMapDataKind.discoveredPoints:
        final id = (concernId ?? '').toLowerCase();
        if (id.contains('acne') || id.contains('حبوب')) {
          return 'العلامات المرجانية = مواضع الحبوب من قناع التحليل';
        }
        if (id.contains('pore') || id.contains('مسام')) {
          return 'العلامات السماوية = مواضع المسام من قناع التحليل';
        }
        return 'العلامات الأرجوانية = مواضع التصبغ من قناع التحليل';
      case PerfectMaskMapDataKind.intensityAreaMask:
        final id = (concernId ?? '').toLowerCase();
        if (id.contains('oil') || id.contains('دهون') || id.contains('زهم')) {
          return 'التلوين الكهرماني = مناطق الدهون من قناع التحليل';
        }
        if (id.contains('redness') || id.contains('احمرار')) {
          return 'التلوين الوردي = مناطق الاحمرار من قناع التحليل';
        }
        if (id.contains('hydrat') ||
            id.contains('moisture') ||
            id.contains('ترطيب')) {
          return 'التلوين الأزرق = مناطق الترطيب من قناع التحليل (دلالة الشدة كما في القناع)';
        }
        if (id.contains('texture') || id.contains('ملمس')) {
          return 'التلوين الفيروزي = قناع الملمس من التحليل';
        }
        if (id.contains('radiance') || id.contains('إشراق')) {
          return 'التلوين الذهبي = قناع الإشراق من التحليل (دون تفتيح البشرة)';
        }
        return 'التلوين الشفاف = مناطق الإشارة من قناع التحليل';
      case PerfectMaskMapDataKind.measurementRegionBoundary:
        return 'الإطار الهادئ = حدود منطقة القياس من المزود — ليست نتائج مكتشفة';
      case PerfectMaskMapDataKind.scoreOnly:
        return 'لا خريطة مكانية — الدرجة من التحليل فقط';
      case PerfectMaskMapDataKind.regionMaskAbsent:
        return 'لا قناع خاص بهذه المنطقة — لم يُعرض قناع الوجه كله بديلًا';
      case PerfectMaskMapDataKind.unavailable:
        return 'التعيين غير متاح لهذا المؤشر حالياً';
      case PerfectMaskMapDataKind.undetermined:
        return 'خريطة مكانية من المزود — نوع الرسم غير مؤكد في العقد لهذه المحاولة';
    }
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
        var out = (gated * profile.alphaGain * (a / 255.0)).round();
        if (out <= 0) return 0;
        // Clarify sparse cores that already passed the gate — no new pixels.
        if (profile.minVisibleAlpha > 0 && out < profile.minVisibleAlpha) {
          out = profile.minVisibleAlpha;
        }
        return out.clamp(0, 255);
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
        final present =
            SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
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
    return Alignment((nx * 2) - 1, (ny * 2) - 1);
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
        final present =
            SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
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
    if (id.contains('hydrat') ||
        id.contains('moisture') ||
        id.contains('ترطيب')) {
      return const ['cheeks_left', 'cheeks_right'];
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return const ['forehead', 'nose', 'chin'];
    }
    return const [];
  }
}
