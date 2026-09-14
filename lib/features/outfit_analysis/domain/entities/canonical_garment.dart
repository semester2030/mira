/// Read-only Flutter projection of the frozen `garment-schema-v1` contract.
///
/// This client model intentionally exposes only fields consumed by Fashion.
/// Garment Intelligence remains the owner of validation, identity, and mapping.
class CanonicalGarment {
  final String garmentId;
  final String version;
  final CanonicalGarmentIdentity identity;
  final CanonicalGarmentAttributes attributes;
  final CanonicalGarmentGeometryRef? geometryRef;
  final double confidence;
  final String availability;
  final String source;
  final List<String> limitations;
  final CanonicalGarmentLocaleLabels? localeLabels;

  const CanonicalGarment({
    required this.garmentId,
    required this.version,
    required this.identity,
    required this.attributes,
    required this.geometryRef,
    required this.confidence,
    required this.availability,
    required this.source,
    required this.limitations,
    required this.localeLabels,
  });

  factory CanonicalGarment.fromJson(Map<String, dynamic> json) {
    final identity = _requiredMap(json, 'identity');
    final attributes = _requiredMap(json, 'attributes');
    final confidence = _requiredNumber(json, 'confidence').toDouble();
    if (confidence < 0 || confidence > 1) {
      throw const FormatException(
        'CanonicalGarment.confidence must be between 0 and 1',
      );
    }

    return CanonicalGarment(
      garmentId: _requiredString(json, 'garmentId'),
      version: _requiredString(json, 'version'),
      identity: CanonicalGarmentIdentity.fromJson(identity),
      attributes: CanonicalGarmentAttributes.fromJson(attributes),
      geometryRef: json['geometryRef'] == null
          ? null
          : CanonicalGarmentGeometryRef.fromJson(
              _requiredMap(json, 'geometryRef'),
            ),
      confidence: confidence,
      availability: _requiredString(json, 'availability'),
      source: _requiredString(json, 'source'),
      limitations: _stringList(json['limitations'], 'limitations'),
      localeLabels: json['localeLabels'] == null
          ? null
          : CanonicalGarmentLocaleLabels.fromJson(
              _requiredMap(json, 'localeLabels'),
            ),
    );
  }
}

class CanonicalGarmentIdentity {
  final String categoryId;
  final String? subcategoryId;
  final String typeId;
  final String entityClass;

  const CanonicalGarmentIdentity({
    required this.categoryId,
    required this.subcategoryId,
    required this.typeId,
    required this.entityClass,
  });

  factory CanonicalGarmentIdentity.fromJson(Map<String, dynamic> json) {
    return CanonicalGarmentIdentity(
      categoryId: _requiredString(json, 'categoryId'),
      subcategoryId: _optionalString(json['subcategoryId']),
      typeId: _requiredString(json, 'typeId'),
      entityClass: _requiredString(json, 'entityClass'),
    );
  }
}

class CanonicalGarmentAttributes {
  final List<String> colors;
  final String? pattern;
  final List<String> season;
  final List<String> occasion;
  final List<String> styleHints;

  const CanonicalGarmentAttributes({
    required this.colors,
    required this.pattern,
    required this.season,
    required this.occasion,
    required this.styleHints,
  });

  factory CanonicalGarmentAttributes.fromJson(Map<String, dynamic> json) {
    // Material is required by the frozen schema even though Flutter does not
    // interpret it. Requiring its presence prevents a partial payload from
    // being accepted as canonical.
    _requiredMap(json, 'material');
    return CanonicalGarmentAttributes(
      colors: _stringList(json['colors'], 'attributes.colors'),
      pattern: _optionalString(json['pattern']),
      season: _stringList(json['season'], 'attributes.season'),
      occasion: _stringList(json['occasion'], 'attributes.occasion'),
      styleHints: _stringList(json['styleHints'], 'attributes.styleHints'),
    );
  }
}

class CanonicalGarmentGeometryRef {
  final String? segmentId;
  final String? regionRole;

  const CanonicalGarmentGeometryRef({this.segmentId, this.regionRole});

  factory CanonicalGarmentGeometryRef.fromJson(Map<String, dynamic> json) {
    return CanonicalGarmentGeometryRef(
      segmentId: _optionalString(json['segmentId']),
      regionRole: _optionalString(json['regionRole']),
    );
  }
}

class CanonicalGarmentLocaleLabels {
  final String? en;
  final String? ar;

  const CanonicalGarmentLocaleLabels({this.en, this.ar});

  factory CanonicalGarmentLocaleLabels.fromJson(Map<String, dynamic> json) {
    return CanonicalGarmentLocaleLabels(
      en: _optionalString(json['en']),
      ar: _optionalString(json['ar']),
    );
  }
}

class VisionOutfitAnalyzeResult {
  final List<CanonicalGarment> garments;
  final Map<String, dynamic>? analysis;
  final Map<String, dynamic> meta;

  const VisionOutfitAnalyzeResult({
    required this.garments,
    this.analysis,
    required this.meta,
  });

  factory VisionOutfitAnalyzeResult.fromJson(Map<String, dynamic> json) {
    final rawGarments = json['garments'];
    if (rawGarments is! List) {
      throw const FormatException(
        'Vision outfit response is missing canonical garments',
      );
    }
    final meta = _requiredMap(json, 'meta');
    final gate = _requiredString(meta, 'analysisGate');
    if (gate != 'proceed' && gate != 'degraded' && gate != 'blocked') {
      throw FormatException('Unknown analysisGate: $gate');
    }

    final garments = rawGarments
        .map((item) {
          if (item is! Map) {
            throw const FormatException(
              'Vision outfit garments must contain objects',
            );
          }
          return CanonicalGarment.fromJson(Map<String, dynamic>.from(item));
        })
        .toList(growable: false);

    if (gate != 'blocked' && garments.isEmpty) {
      throw const FormatException(
        'Non-blocked canonical response must contain garments',
      );
    }

    final rawAnalysis = json['analysis'];
    if (rawAnalysis != null && rawAnalysis is! Map) {
      throw const FormatException('Vision outfit analysis must be an object');
    }

    return VisionOutfitAnalyzeResult(
      garments: garments,
      analysis: rawAnalysis == null
          ? null
          : Map<String, dynamic>.from(rawAnalysis as Map),
      meta: meta,
    );
  }

  String get analysisGate => meta['analysisGate'] as String;

  String? get userMessageAr => _optionalString(meta['userMessageAr']);

  bool get isBlocked => analysisGate == 'blocked';

  int get confidencePercent {
    final value = meta['confidence'];
    if (value is! num) return 0;
    final normalized = value <= 1 ? value * 100 : value;
    return normalized.round().clamp(0, 100);
  }
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map) {
    throw FormatException('$key must be an object');
  }
  return Map<String, dynamic>.from(value);
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('$key must be a non-empty string');
  }
  return value;
}

num _requiredNumber(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! num) {
    throw FormatException('$key must be a number');
  }
  return value;
}

String? _optionalString(dynamic value) {
  if (value == null) return null;
  if (value is! String) {
    throw const FormatException('Optional string field has invalid type');
  }
  return value;
}

List<String> _stringList(dynamic value, String field) {
  if (value is! List || value.any((item) => item is! String)) {
    throw FormatException('$field must be a string list');
  }
  return List<String>.unmodifiable(value.cast<String>());
}
