import 'dart:typed_data';

import 'package:image/image.dart' as im;

import '../presentation/geometry/skin_face_map_visual_tokens.dart';

/// Sanitized stats for Perfect PNG encoding / MIRA decode (no face pixels logged).
class PerfectMaskEncodingAudit {
  const PerfectMaskEncodingAudit({
    required this.width,
    required this.height,
    required this.pixelCount,
    required this.nonzeroAlphaCount,
    required this.dominantR,
    required this.dominantG,
    required this.dominantB,
    required this.dominantA,
    required this.dominantCount,
    required this.maxLuminance,
    required this.presentationNonzeroCount,
    required this.presentationBBox,
    required this.rawAlphaBBox,
  });

  final int width;
  final int height;
  final int pixelCount;
  final int nonzeroAlphaCount;
  final int dominantR;
  final int dominantG;
  final int dominantB;
  final int dominantA;
  final int dominantCount;
  final int maxLuminance;
  final int presentationNonzeroCount;
  final ({int minX, int minY, int maxX, int maxY})? presentationBBox;
  final ({int minX, int minY, int maxX, int maxY})? rawAlphaBBox;
}

/// CPU Perfect→presentation remapper (domain-owned decode contract).
///
/// Perfect HD concern PNGs encode signal primarily in **RGB luminance over a
/// face-wide gray wash with soft alpha** — not as sparse Perfect alpha alone.
/// GPU ColorFilter.matrix diverged from
/// [SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba].
abstract final class PerfectMaskPresentationDecoder {
  PerfectMaskPresentationDecoder._();

  /// Remap Perfect PNG → white RGB + presentation alpha. Same W×H. No dilation.
  static Uint8List? remapToPresentationPng({
    required Uint8List perfectPngBytes,
    required PerfectMaskPresentationProfile profile,
  }) {
    final decoded = im.decodeImage(perfectPngBytes);
    if (decoded == null || decoded.width <= 0 || decoded.height <= 0) {
      return null;
    }
    final out = im.Image(
      width: decoded.width,
      height: decoded.height,
      numChannels: 4,
    );
    for (var y = 0; y < decoded.height; y++) {
      for (var x = 0; x < decoded.width; x++) {
        final p = decoded.getPixel(x, y);
        final a = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: p.r.toInt(),
          g: p.g.toInt(),
          b: p.b.toInt(),
          a: p.a.toInt(),
          profile: profile,
        );
        out.setPixelRgba(x, y, 255, 255, 255, a);
      }
    }
    return Uint8List.fromList(im.encodePng(out));
  }

  /// Stride audit of raw Perfect encoding + presentation decode (sanitized).
  static PerfectMaskEncodingAudit? audit({
    required Uint8List perfectPngBytes,
    required PerfectMaskPresentationProfile profile,
    int step = 1,
  }) {
    final decoded = im.decodeImage(perfectPngBytes);
    if (decoded == null || decoded.width <= 0 || decoded.height <= 0) {
      return null;
    }
    final hist = <int, int>{};
    var nonzeroA = 0;
    var maxLum = 0;
    var presN = 0;
    int? aMinX, aMinY, aMaxX, aMaxY;
    int? pMinX, pMinY, pMaxX, pMaxY;
    final w = decoded.width;
    final h = decoded.height;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        final p = decoded.getPixel(x, y);
        final r = p.r.toInt();
        final g = p.g.toInt();
        final b = p.b.toInt();
        final a = p.a.toInt();
        final key = (r << 24) | (g << 16) | (b << 8) | a;
        hist[key] = (hist[key] ?? 0) + 1;
        if (a > 0) {
          nonzeroA++;
          aMinX = aMinX == null ? x : (x < aMinX ? x : aMinX);
          aMinY = aMinY == null ? y : (y < aMinY ? y : aMinY);
          aMaxX = aMaxX == null ? x : (x > aMaxX ? x : aMaxX);
          aMaxY = aMaxY == null ? y : (y > aMaxY ? y : aMaxY);
        }
        final lum = (0.299 * r + 0.587 * g + 0.114 * b).round();
        if (lum > maxLum) maxLum = lum;
        final pa = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: r,
          g: g,
          b: b,
          a: a,
          profile: profile,
        );
        if (pa > 0) {
          presN++;
          pMinX = pMinX == null ? x : (x < pMinX ? x : pMinX);
          pMinY = pMinY == null ? y : (y < pMinY ? y : pMinY);
          pMaxX = pMaxX == null ? x : (x > pMaxX ? x : pMaxX);
          pMaxY = pMaxY == null ? y : (y > pMaxY ? y : pMaxY);
        }
      }
    }
    var domKey = 0;
    var domCount = 0;
    hist.forEach((k, c) {
      if (c > domCount) {
        domCount = c;
        domKey = k;
      }
    });
    return PerfectMaskEncodingAudit(
      width: w,
      height: h,
      pixelCount: ((w + step - 1) ~/ step) * ((h + step - 1) ~/ step),
      nonzeroAlphaCount: nonzeroA,
      dominantR: (domKey >> 24) & 0xff,
      dominantG: (domKey >> 16) & 0xff,
      dominantB: (domKey >> 8) & 0xff,
      dominantA: domKey & 0xff,
      dominantCount: domCount,
      maxLuminance: maxLum,
      presentationNonzeroCount: presN,
      presentationBBox: pMinX == null
          ? null
          : (minX: pMinX, minY: pMinY!, maxX: pMaxX!, maxY: pMaxY!),
      rawAlphaBBox: aMinX == null
          ? null
          : (minX: aMinX, minY: aMinY!, maxX: aMaxX!, maxY: aMaxY!),
    );
  }
}
