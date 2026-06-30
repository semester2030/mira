/// Universal Fashion Schema v1 — provider-agnostic vision contract.
/// Official reference: docs/mira-vision-platform.html
class FashionVisionDocument {
  final String schemaVersion;
  final String analysisGate;
  final Map<String, dynamic> provenance;
  final Map<String, dynamic> geometry;
  final Map<String, dynamic> semantics;
  final Map<String, dynamic> fusion;

  const FashionVisionDocument({
    required this.schemaVersion,
    required this.analysisGate,
    required this.provenance,
    required this.geometry,
    required this.semantics,
    required this.fusion,
  });

  factory FashionVisionDocument.fromJson(Map<String, dynamic> json) {
    return FashionVisionDocument(
      schemaVersion: json['schemaVersion'] as String? ?? '1.0.0',
      analysisGate: json['analysisGate'] as String? ?? 'blocked',
      provenance: Map<String, dynamic>.from(
        json['provenance'] as Map? ?? const {},
      ),
      geometry: Map<String, dynamic>.from(
        json['geometry'] as Map? ?? const {},
      ),
      semantics: Map<String, dynamic>.from(
        json['semantics'] as Map? ?? const {},
      ),
      fusion: Map<String, dynamic>.from(json['fusion'] as Map? ?? const {}),
    );
  }

  double get overallConfidence {
    final v = fusion['overallConfidence'];
    if (v is num) return v.toDouble();
    return 0;
  }
}

class VisionOutfitAnalyzeResult {
  final FashionVisionDocument fashionVision;
  final Map<String, dynamic>? analysis;
  final Map<String, dynamic> meta;

  const VisionOutfitAnalyzeResult({
    required this.fashionVision,
    this.analysis,
    required this.meta,
  });

  factory VisionOutfitAnalyzeResult.fromJson(Map<String, dynamic> json) {
    return VisionOutfitAnalyzeResult(
      fashionVision: FashionVisionDocument.fromJson(
        Map<String, dynamic>.from(json['fashionVision'] as Map? ?? const {}),
      ),
      analysis: json['analysis'] != null
          ? Map<String, dynamic>.from(json['analysis'] as Map)
          : null,
      meta: Map<String, dynamic>.from(json['meta'] as Map? ?? const {}),
    );
  }

  String? get userMessageAr => meta['userMessageAr'] as String?;

  bool get isBlocked => fashionVision.analysisGate == 'blocked';
}
