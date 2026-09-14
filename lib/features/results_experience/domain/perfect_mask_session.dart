import 'dart:convert';
import 'dart:typed_data';

/// In-memory Perfect HD mask lifecycle for one Skin analysis session.
/// Canonical owner — decode once, reuse on tap/rebuild. Never persist.
class PerfectMaskSession {
  PerfectMaskSession._(this._byKey);

  final Map<String, PerfectMaskArtifact> _byKey;
  final Map<String, int> _hitCounts = {};

  static PerfectMaskSession? fromApiPayload(List<dynamic>? raw) {
    if (raw == null || raw.isEmpty) return null;
    final map = <String, PerfectMaskArtifact>{};
    for (final row in raw) {
      if (row is! Map) continue;
      final m = Map<String, dynamic>.from(row);
      final concernType = '${m['concernType'] ?? ''}';
      if (concernType.isEmpty || concernType == 'resize_image') continue;
      final region = m['region'] as String?;
      final b64 = m['maskBase64'] as String?;
      Uint8List? bytes;
      if (b64 != null && b64.isNotEmpty) {
        try {
          bytes = base64Decode(b64);
        } catch (_) {
          bytes = null;
        }
      }
      final art = PerfectMaskArtifact(
        concernType: concernType,
        region: region,
        rawScore: (m['rawScore'] as num?)?.toDouble(),
        uiScore: (m['uiScore'] as num?)?.toDouble(),
        scoreOnly: m['scoreOnly'] == true,
        width: m['width'] as int?,
        height: m['height'] as int?,
        aligned: m['alignedWithSource'] as bool?,
        contentType: m['contentType'] as String?,
        bytes: bytes,
      );
      map[art.key] = art;
    }
    if (map.isEmpty) return null;
    return PerfectMaskSession._(map);
  }

  bool get hasAnyMask =>
      _byKey.values.any((a) => a.bytes != null && a.bytes!.isNotEmpty);

  PerfectMaskArtifact? lookup({
    required String consumerMetricId,
    String? subregion,
  }) {
    final provider = providerTypeForConsumerMetric(consumerMetricId);
    if (provider == null) return null;
    final region = subregion ?? _defaultRegion(provider);
    final keys = <String>[
      if (region != null) '$provider::$region',
      '$provider::root',
      if (region == 'whole' || region == null) '$provider::whole',
      if (region == 'whole' || region == null) '$provider::all',
    ];
    for (final k in keys) {
      final hit = _byKey[k];
      if (hit != null && hit.bytes != null && hit.bytes!.isNotEmpty) {
        _hitCounts[k] = (_hitCounts[k] ?? 0) + 1;
        return hit;
      }
    }
    for (final a in _byKey.values) {
      if (a.concernType != provider) continue;
      if (region == null ||
          a.region == null ||
          a.region == region ||
          (a.region == 'all' && region == 'whole')) {
        if (a.bytes != null && a.bytes!.isNotEmpty) {
          _hitCounts[a.key] = (_hitCounts[a.key] ?? 0) + 1;
          return a;
        }
      }
    }
    return null;
  }

  List<String> providerSubregions(String consumerMetricId) {
    final provider = providerTypeForConsumerMetric(consumerMetricId);
    if (provider == null) return const [];
    final regions = <String>{};
    for (final a in _byKey.values) {
      if (a.concernType != provider) continue;
      if (a.region != null &&
          a.region != 'all' &&
          a.bytes != null &&
          a.bytes!.isNotEmpty) {
        regions.add(a.region!);
      }
    }
    final order = provider == 'hd_pore'
        ? const ['whole', 'forehead', 'nose', 'cheek']
        : provider == 'hd_wrinkle'
            ? const [
                'whole',
                'forehead',
                'glabellar',
                'crowfeet',
                'periocular',
                'nasolabial',
                'marionette',
              ]
            : (regions.toList()..sort());
    return order.where(regions.contains).toList(growable: false);
  }

  int cacheHitsFor(String key) => _hitCounts[key] ?? 0;

  void dispose() {
    _byKey.clear();
    _hitCounts.clear();
  }

  static String? _defaultRegion(String provider) {
    if (provider == 'hd_pore' ||
        provider == 'hd_wrinkle' ||
        provider == 'hd_texture' ||
        provider == 'hd_acne') {
      return 'whole';
    }
    return null;
  }

  static String? providerTypeForConsumerMetric(String metricId) {
    final id = metricId.toLowerCase().replaceFirst('metric_', '');
    if (id.contains('pigment') ||
        id.contains('age_spot') ||
        id.contains('dark_spot') ||
        (id.contains('spot') && !id.contains('dark_circle'))) {
      return 'hd_age_spot';
    }
    if (id.contains('pore')) return 'hd_pore';
    if (id.contains('wrinkle')) return 'hd_wrinkle';
    if (id.contains('redness') || id.contains('red')) return 'hd_redness';
    if (id.contains('texture')) return 'hd_texture';
    if (id.contains('acne')) return 'hd_acne';
    if (id.contains('hydrat') || id.contains('moisture')) return 'hd_moisture';
    if (id.contains('oil')) return 'hd_oiliness';
    if (id.contains('radiance')) return 'hd_radiance';
    if (id.contains('dark_circle')) return 'hd_dark_circle';
    if (id.contains('eye_bag')) return 'hd_eye_bag';
    if (id.contains('droopy_upper')) return 'hd_droopy_upper_eyelid';
    if (id.contains('droopy_lower')) return 'hd_droopy_lower_eyelid';
    if (id.contains('firmness')) return 'hd_firmness';
    if (id.contains('tear_trough')) return 'hd_tear_trough';
    if (id.contains('skin_type')) return 'hd_skin_type';
    if (id.startsWith('hd_')) return id;
    return null;
  }

  /// Reverse map: Perfect concernType → consumer carousel id.
  static String? consumerMetricIdForProvider(String providerType) {
    switch (providerType) {
      case 'hd_age_spot':
        return 'pigmentation';
      case 'hd_pore':
        return 'pores';
      case 'hd_wrinkle':
        return 'wrinkles';
      case 'hd_redness':
        return 'redness';
      case 'hd_texture':
        return 'texture';
      case 'hd_acne':
        return 'acne';
      case 'hd_moisture':
        return 'hydration';
      case 'hd_oiliness':
        return 'oiliness';
      case 'hd_radiance':
        return 'radiance';
      case 'hd_dark_circle':
        return 'dark_circle';
      case 'hd_eye_bag':
        return 'eye_bag';
      case 'hd_droopy_upper_eyelid':
        return 'droopy_upper';
      case 'hd_droopy_lower_eyelid':
        return 'droopy_lower';
      case 'hd_firmness':
        return 'firmness';
      case 'hd_tear_trough':
        return 'tear_trough';
      case 'hd_skin_type':
        return 'skin_type';
      default:
        return null;
    }
  }

  /// Provider types present in the canonical Perfect session payload.
  /// Availability for carousel — independent of mask-byte materialization.
  Set<String> providersPresent() {
    final out = <String>{};
    for (final a in _byKey.values) {
      if (a.concernType == 'resize_image') continue;
      out.add(a.concernType);
    }
    return out;
  }

  /// Provider types that currently have real mask bytes in-session.
  Set<String> providersWithMaskBytes() {
    final out = <String>{};
    for (final a in _byKey.values) {
      if (a.concernType == 'resize_image') continue;
      if (a.scoreOnly) continue;
      if (a.bytes != null && a.bytes!.isNotEmpty) {
        out.add(a.concernType);
      }
    }
    return out;
  }
}

class PerfectMaskArtifact {
  PerfectMaskArtifact({
    required this.concernType,
    this.region,
    this.rawScore,
    this.uiScore,
    required this.scoreOnly,
    this.width,
    this.height,
    this.aligned,
    this.contentType,
    this.bytes,
  });

  final String concernType;
  final String? region;
  final double? rawScore;
  final double? uiScore;
  final bool scoreOnly;
  final int? width;
  final int? height;
  final bool? aligned;
  final String? contentType;
  final Uint8List? bytes;

  String get key => '$concernType::${region ?? 'root'}';
}
