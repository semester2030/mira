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

/// Infer outfit topology from segment map + optional garment label (Arabic).
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
            pieceCount: 1,
            onePiece: false,
          );
    }

    final hasUpper = map.regions.any((r) => r.zone == OutfitSegmentZone.upperBody);
    final hasLower = map.regions.any((r) => r.zone == OutfitSegmentZone.lowerBody);
    final hasOuter = map.regions.any(_isOuterwearLabel);
    final dressLike = map.regions.any(_isDressLabel) ||
        (garmentLabelAr?.contains('فستان') ?? false);

    if (dressLike && !hasLower) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.onePiece,
        pieceCount: 1,
        onePiece: true,
        regionRole: labelMeta?.regionRole ?? 'full_body',
      );
    }

    if (hasOuter && (hasUpper || hasLower)) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.layered,
        pieceCount: 3,
        onePiece: false,
        regionRole: labelMeta?.regionRole ?? 'outerwear',
      );
    }

    if (hasUpper && hasLower) {
      return OutfitTopologyResult(
        silhouetteHint: OutfitSilhouetteHint.twoPiece,
        pieceCount: 2,
        onePiece: false,
        regionRole: labelMeta?.regionRole ?? _roleFromZones(hasUpper, hasLower),
      );
    }

    if (labelMeta != null) {
      return _fromMeta(labelMeta)!;
    }

    return OutfitTopologyResult(
      silhouetteHint: OutfitSilhouetteHint.unknown,
      pieceCount: map.regions.length.clamp(1, 4),
      onePiece: false,
      regionRole: _roleFromZones(hasUpper, hasLower),
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

  static bool _isOuterwearLabel(OutfitSegmentRegion r) {
    final l = '${r.labelAr} ${r.labelEn}'.toLowerCase();
    return l.contains('جاك') ||
        l.contains('عب') ||
        l.contains('jacket') ||
        l.contains('coat') ||
        l.contains('blazer') ||
        l.contains('abaya');
  }

  static bool _isDressLabel(OutfitSegmentRegion r) {
    final l = '${r.labelAr} ${r.labelEn}'.toLowerCase();
    return l.contains('فستان') || l.contains('dress') || l.contains('gown');
  }

  static String? _roleFromZones(bool hasUpper, bool hasLower) {
    if (hasUpper && hasLower) return 'upper';
    if (hasLower) return 'lower';
    if (hasUpper) return 'upper';
    return null;
  }
}
