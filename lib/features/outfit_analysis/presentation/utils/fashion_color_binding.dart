import 'package:flutter/material.dart';

import '../../domain/catalog/fashion_catalog_types.dart';
import '../../domain/catalog/fashion_color_library.dart';
import '../../domain/catalog/fashion_color_library_data.dart';
import '../../domain/catalog/professional_color_matcher.dart';
import '../../domain/entities/detected_garment_color.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_segment_map.dart';

/// Where a resolved swatch came from — defaults are distinguished by source,
/// never by hex value alone.
enum FashionColorSource {
  detected,
  catalog,
  matcherFallback,
  unknown,
}

class FashionColorResolve {
  final Color? color;
  final String? hex;
  final String displayNameAr;
  final FashionColorSource source;

  const FashionColorResolve({
    required this.color,
    required this.hex,
    required this.displayNameAr,
    required this.source,
  });

  static const unavailable = FashionColorResolve(
    color: null,
    hex: null,
    displayNameAr: 'غير متاح',
    source: FashionColorSource.unknown,
  );

  bool get isAvailable => color != null;
}

/// Presentation-safe color binding — HEX first, never invent gray swatches.
abstract final class FashionColorBinding {
  FashionColorBinding._();

  /// Gray catalog miss fallback used historically — not a real detected color.
  static const String falseGrayHex = '#9E9E9E';

  static const unavailableLabel = 'غير متاح';

  static Color? fromHex(String? hex) {
    if (hex == null) return null;
    final h = hex.trim().replaceFirst('#', '');
    if (h.length != 6) return null;
    try {
      return Color(int.parse('FF$h', radix: 16));
    } catch (_) {
      return null;
    }
  }

  static bool isFalseGrayHex(String? hex) {
    if (hex == null) return false;
    return hex.trim().replaceFirst('#', '').toUpperCase() == '9E9E9E';
  }

  static bool _nameMeansGray(String? nameAr) {
    final n = (nameAr ?? '').trim().toLowerCase();
    return n.contains('رمادي') || n.contains('gray') || n.contains('grey');
  }

  /// True gray chroma (low saturation) — kept even without a gray name when
  /// [source] is [FashionColorSource.detected].
  static bool isTrueGrayHex(String? hex) {
    final c = fromHex(hex);
    if (c == null) return false;
    final max = [c.red, c.green, c.blue].reduce((a, b) => a > b ? a : b);
    final min = [c.red, c.green, c.blue].reduce((a, b) => a < b ? a : b);
    return (max - min) <= 18;
  }

  /// Common Arabic aliases → library names (HEX still preferred when present).
  static const _aliases = <String, String>{
    'عنابي': 'نبيتي غامق',
    'عنّابي': 'نبيتي غامق',
    'burgundy': 'نبيتي غامق',
    'maroon': 'نبيتي غامق',
    'wine': 'نبيتي غامق',
    'تركوازي': 'تركواز متوسط',
    'كحلي': 'كحلي غامق',
    'navy': 'كحلي غامق',
    'سماوي': 'أزرق سماوي',
    'أزرق سماوي': 'أزرق سماوي',
    'sky blue': 'أزرق سماوي',
    'skyblue': 'أزرق سماوي',
  };

  /// Resolve display color from optional hex + Arabic name.
  /// Returns null when unknown — callers must show truthful empty/partial state.
  static Color? resolve({
    String? hex,
    String? nameAr,
    FashionColorSource source = FashionColorSource.unknown,
  }) {
    return resolveDetailed(hex: hex, nameAr: nameAr, source: source).color;
  }

  static FashionColorResolve resolveDetailed({
    String? hex,
    String? nameAr,
    FashionColorSource source = FashionColorSource.unknown,
  }) {
    final trimmedHex = hex?.trim();
    if (trimmedHex != null && trimmedHex.isNotEmpty) {
      final isFalseGray = isFalseGrayHex(trimmedHex);
      if (isFalseGray &&
          source != FashionColorSource.detected &&
          !_nameMeansGray(nameAr)) {
        // Matcher miss fallback — do not paint as real.
      } else if (isFalseGray &&
          source == FashionColorSource.detected &&
          !_nameMeansGray(nameAr) &&
          !isTrueGrayHex(trimmedHex)) {
        // Non-gray detection wrongly labeled #9E9E9E — reject.
      } else {
        final parsed = fromHex(trimmedHex);
        if (parsed != null) {
          final name = (nameAr ?? '').trim();
          return FashionColorResolve(
            color: parsed,
            hex: trimmedHex.startsWith('#') ? trimmedHex : '#$trimmedHex',
            displayNameAr: name.isEmpty
                ? (isTrueGrayHex(trimmedHex) ? 'رمادي' : unavailableLabel)
                : name,
            source: source == FashionColorSource.unknown
                ? FashionColorSource.detected
                : source,
          );
        }
      }
    }

    // Detected true-gray hex without name already handled above when hex present.
    final name = nameAr?.trim() ?? '';
    if (name.isEmpty) return FashionColorResolve.unavailable;

    final aliased = _aliases[name] ?? _aliases[name.toLowerCase()] ?? name;
    final entry = FashionColorLibrary.byName(aliased) ??
        FashionColorLibrary.byName(name) ??
        fuzzyByName(aliased) ??
        fuzzyByName(name);
    if (entry != null) {
      return FashionColorResolve(
        color: entry.color,
        hex: '#${entry.color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}',
        displayNameAr: entry.nameAr,
        source: FashionColorSource.catalog,
      );
    }

    final catalogHex = ProfessionalColorMatcher.hexForName(aliased);
    if (catalogHex.toUpperCase() == falseGrayHex) {
      if (_nameMeansGray(name)) {
        return FashionColorResolve(
          color: fromHex(falseGrayHex),
          hex: falseGrayHex,
          displayNameAr: name,
          source: FashionColorSource.catalog,
        );
      }
      return FashionColorResolve.unavailable;
    }
    final parsed = fromHex(catalogHex);
    if (parsed == null) return FashionColorResolve.unavailable;
    return FashionColorResolve(
      color: parsed,
      hex: catalogHex,
      displayNameAr: name,
      source: FashionColorSource.matcherFallback,
    );
  }

  /// Bind current color to the **selected** garment — never pick highest
  /// confidence from the global outfit palette, and never borrow another
  /// piece's color when this piece has no fabric evidence.
  static FashionColorResolve forSelectedGarment({
    required OutfitAnalysis analysis,
    required String garmentLabelAr,
  }) {
    final map = analysis.segmentMap;
    final region = map?.regionForGarmentLabel(garmentLabelAr);

    if (region != null && region.colors.isNotEmpty) {
      final name = region.colors.first.trim();
      final detail = _detailMatchingName(
        map?.garmentPalette.detailedColors ?? const [],
        name,
      );
      return resolveDetailed(
        hex: detail?.hex,
        nameAr: detail?.displayNameAr.isNotEmpty == true
            ? detail!.displayNameAr
            : name,
        source: FashionColorSource.detected,
      );
    }

    // Region exists but no per-piece colors — zone list only if it is the
    // sole clothing region in that zone (avoids borrowing a neighbor piece).
    if (region != null && map != null) {
      final sameZone = map.regions
          .where(
            (r) =>
                r.zone == region.zone &&
                !OutfitSegmentMap.isAnatomyBandLabel(r) &&
                r.zone != OutfitSegmentZone.head,
          )
          .toList();
      if (sameZone.length == 1) {
        final zoneColors = map.colorsForZone(region.zone);
        if (zoneColors.isNotEmpty) {
          return resolveDetailed(
            nameAr: zoneColors.first,
            source: FashionColorSource.detected,
          );
        }
      }
    }

    // Detected piece label with palette detail that shares **this** piece name.
    final details = map?.garmentPalette.detailedColors ?? const [];
    for (final piece in analysis.detectedPieces) {
      if (piece.contains(garmentLabelAr) || garmentLabelAr.contains(piece)) {
        final detail = _detailMatchingName(details, piece);
        if (detail != null) {
          return resolveDetailed(
            hex: detail.hex,
            nameAr: detail.displayNameAr,
            source: FashionColorSource.detected,
          );
        }
      }
    }

    // No piece-linked evidence — honest unavailable (do NOT use global
    // dominantColors / upperBodyColors / clothingType fallbacks).
    return FashionColorResolve.unavailable;
  }

  static DetectedGarmentColor? _detailMatchingName(
    List<DetectedGarmentColor> details,
    String name,
  ) {
    for (final d in details) {
      if (d.nameAr == name ||
          d.displayNameAr == name ||
          d.nameAr.contains(name) ||
          name.contains(d.nameAr)) {
        return d;
      }
    }
    return null;
  }

  static FashionColorEntry? fuzzyByName(String name) {
    final exact = FashionColorLibrary.byName(name);
    if (exact != null) return exact;

    FashionColorEntry? best;
    var bestLen = 0;
    for (final e in colorEntries.values) {
      final ar = e.nameAr;
      if (ar.length < 2) continue;
      if (name == ar || name.contains(ar) || ar.contains(name)) {
        if (ar.length > bestLen) {
          best = e;
          bestLen = ar.length;
        }
      }
    }
    if (best != null) return best;

    final parts = name.split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      final byBase = FashionColorLibrary.byName(parts.first);
      if (byBase != null) return byBase;
    }
    return null;
  }

  static List<DetectedGarmentColor> garmentDetails(OutfitAnalysis analysis) {
    return analysis.segmentMap?.garmentPalette.detailedColors ?? const [];
  }
}
