import '../entities/outfit_segment_map.dart';

/// Q4 perception topology — mirrors docs/mira-q4-perception-taxonomy.js (client-side).
abstract final class OutfitSilhouetteHint {
  static const onePiece = 'one_piece';
  static const twoPiece = 'two_piece';
  static const layered = 'layered';
  static const unknown = 'unknown';
}

class OutfitPieceMeta {
  final String topology;
  final int pieceCount;
  final String regionRole;

  const OutfitPieceMeta({
    required this.topology,
    required this.pieceCount,
    required this.regionRole,
  });
}

class OutfitTopologyResult {
  final String silhouetteHint;
  final int pieceCount;
  final bool onePiece;
  final String? regionRole;

  const OutfitTopologyResult({
    required this.silhouetteHint,
    required this.pieceCount,
    required this.onePiece,
    this.regionRole,
  });
}

/// Infer outfit topology from **detected clothing**, not anatomy bands.
/// Feet / head / accessories never invent a second clothing piece.
abstract final class OutfitTopologyInfer {
  static const _pieceMeta = <String, OutfitPieceMeta>{
    'فستان': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.onePiece,
      pieceCount: 1,
      regionRole: 'full_body',
    ),
    'بلوزة': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.twoPiece,
      pieceCount: 2,
      regionRole: 'upper',
    ),
    'بنطلون': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.twoPiece,
      pieceCount: 2,
      regionRole: 'lower',
    ),
    'جينز': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.twoPiece,
      pieceCount: 2,
      regionRole: 'lower',
    ),
    'تنورة': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.twoPiece,
      pieceCount: 2,
      regionRole: 'lower',
    ),
    'جاكيت': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.layered,
      pieceCount: 3,
      regionRole: 'outerwear',
    ),
    'عباءة': OutfitPieceMeta(
      topology: OutfitSilhouetteHint.layered,
      pieceCount: 2,
      regionRole: 'outerwear',
    ),
  };

  static OutfitTopologyResult infer(
    OutfitSegmentMap? map, {
    String? garmentLabelAr,
  }) {
    final labelMeta = _metaForLabel(garmentLabelAr);
    if (map == null || map.regions.isEmpty) {
      return _fromMeta(labelMeta) ??
          const OutfitTopologyResult(
            silhouetteHint: OutfitSilhouetteHint.unknown,
            pieceCount: 0,
            onePiece: false,
          );
    }

    final clothing = _clothingRegions(map);
    final hasOuter = clothing.any(_isOuterwearLabel) ||
        (garmentLabelAr != null && _isOuterwearText(garmentLabelAr));
    final dressLike = clothing.any(_isDressLabel) ||
        _isDressText(garmentLabelAr) ||
        labelMeta?.topology == OutfitSilhouetteHint.onePiece;

    // Dress + jacket/outerwear is layered — distinct from dress alone.
    if (dressLike && hasOuter) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.layered,
        pieceCount: 2,
        onePiece: false,
        regionRole: 'outerwear',
      );
    }

    if (dressLike) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.onePiece,
        pieceCount: 1,
        onePiece: true,
        regionRole: labelMeta?.regionRole ?? 'full_body',
      );
    }

    final distinct = _distinctClothingPieceLabels(clothing);
    final hasUpperClothing = clothing.any(
      (r) =>
          r.zone == OutfitSegmentZone.upperBody ||
          r.zone == OutfitSegmentZone.waist,
    );
    final hasLowerClothing = clothing.any(
      (r) => r.zone == OutfitSegmentZone.lowerBody,
    );

    if (hasOuter && distinct.length >= 2) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.layered,
        pieceCount: distinct.length.clamp(2, 4),
        onePiece: false,
        regionRole: labelMeta?.regionRole ?? 'outerwear',
      );
    }

    if (distinct.length >= 2 && hasUpperClothing && hasLowerClothing) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.twoPiece,
        pieceCount: 2,
        onePiece: false,
        regionRole: labelMeta?.regionRole ?? 'upper',
      );
    }

    if (labelMeta != null && distinct.isNotEmpty) {
      return _fromMeta(labelMeta)!;
    }

    // Anatomy bands (± feet/head/accessories) without clothing evidence → unknown.
    if (distinct.isEmpty) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.unknown,
        pieceCount: 0,
        onePiece: false,
        regionRole: labelMeta?.regionRole,
      );
    }

    if (labelMeta != null) {
      return _fromMeta(labelMeta)!;
    }

    return const OutfitTopologyResult(
      silhouetteHint: OutfitSilhouetteHint.unknown,
      pieceCount: 0,
      onePiece: false,
    );
  }

  static String? regionRoleForGarment(String? garmentLabelAr) {
    return _metaForLabel(garmentLabelAr)?.regionRole;
  }

  static OutfitPieceMeta? _metaForLabel(String? label) {
    final trimmed = label?.trim() ?? '';
    if (trimmed.isEmpty) return null;
    for (final entry in _pieceMeta.entries) {
      if (trimmed.contains(entry.key)) return entry.value;
    }
    return null;
  }

  static OutfitTopologyResult? _fromMeta(OutfitPieceMeta? meta) {
    if (meta == null) return null;
    return OutfitTopologyResult(
      silhouetteHint: meta.topology,
      pieceCount: meta.pieceCount,
      onePiece: meta.topology == OutfitSilhouetteHint.onePiece,
      regionRole: meta.regionRole,
    );
  }

  /// Clothing only — exclude head/feet/accessories and anatomy band labels.
  static List<OutfitSegmentRegion> _clothingRegions(OutfitSegmentMap map) {
    return map.regions.where((r) {
      if (r.zone == OutfitSegmentZone.head ||
          r.zone == OutfitSegmentZone.feet ||
          r.zone == OutfitSegmentZone.accessories) {
        return false;
      }
      if (OutfitSegmentMap.isAnatomyBandLabel(r)) return false;
      return r.labelAr.trim().isNotEmpty;
    }).toList();
  }

  static bool _isOuterwearLabel(OutfitSegmentRegion r) =>
      _isOuterwearText('${r.labelAr} ${r.labelEn}');

  static bool _isOuterwearText(String? raw) {
    final l = (raw ?? '').toLowerCase();
    return l.contains('جاك') ||
        l.contains('عب') ||
        l.contains('jacket') ||
        l.contains('coat') ||
        l.contains('blazer') ||
        l.contains('abaya') ||
        l.contains('كارديجان') ||
        l.contains('cardigan');
  }

  static bool _isDressLabel(OutfitSegmentRegion r) =>
      _isDressText('${r.labelAr} ${r.labelEn}');

  static bool _isDressText(String? raw) {
    final l = (raw ?? '').toLowerCase();
    return l.contains('فستان') || l.contains('dress') || l.contains('gown');
  }

  static List<String> _distinctClothingPieceLabels(
    List<OutfitSegmentRegion> clothing,
  ) {
    final out = <String>[];
    for (final r in clothing) {
      final key = r.labelAr.trim();
      if (key.isEmpty) continue;
      if (!out.contains(key)) out.add(key);
    }
    return out;
  }
}
