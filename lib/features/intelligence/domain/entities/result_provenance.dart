/// Phase 0 — machine-readable result provenance (mirrors API contract).
enum ResultSource {
  providerMeasured,
  localMeasured,
  locallyCalculated,
  inferred,
  heuristic,
  userSupplied,
  mock,
  unavailable,
}

enum ProvenanceConfidenceLevel {
  high,
  medium,
  low,
  unavailable,
}

class ResultProvenance {
  final ResultSource resultSource;
  final String provider;
  final String? providerVersion;
  final String calculationVersion;
  final int confidence;
  final ProvenanceConfidenceLevel confidenceLevel;
  final String? captureQuality;
  final DateTime generatedAt;
  final List<String> limitations;
  final bool isMock;
  final bool canDisplay;
  final String? unavailableReason;

  const ResultProvenance({
    required this.resultSource,
    required this.provider,
    this.providerVersion,
    required this.calculationVersion,
    required this.confidence,
    required this.confidenceLevel,
    this.captureQuality,
    required this.generatedAt,
    required this.limitations,
    required this.isMock,
    required this.canDisplay,
    this.unavailableReason,
  });

  static ResultProvenance? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final map = Map<String, dynamic>.from(raw);
    return ResultProvenance(
      resultSource: _source(map['resultSource'] as String?),
      provider: map['provider'] as String? ?? 'unknown',
      providerVersion: map['providerVersion'] as String?,
      calculationVersion: map['calculationVersion'] as String? ?? 'unknown',
      confidence: (map['confidence'] as num?)?.toInt() ?? 0,
      confidenceLevel: _level(map['confidenceLevel'] as String?),
      captureQuality: map['captureQuality'] as String?,
      generatedAt: DateTime.tryParse(map['generatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      limitations: (map['limitations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      isMock: map['isMock'] as bool? ?? false,
      canDisplay: map['canDisplay'] as bool? ?? true,
      unavailableReason: map['unavailableReason'] as String?,
    );
  }

  static ResultSource _source(String? v) => switch (v) {
        'provider_measured' => ResultSource.providerMeasured,
        'local_measured' => ResultSource.localMeasured,
        'locally_calculated' => ResultSource.locallyCalculated,
        'inferred' => ResultSource.inferred,
        'heuristic' => ResultSource.heuristic,
        'user_supplied' => ResultSource.userSupplied,
        'mock' => ResultSource.mock,
        _ => ResultSource.unavailable,
      };

  static ProvenanceConfidenceLevel _level(String? v) => switch (v) {
        'high' => ProvenanceConfidenceLevel.high,
        'medium' => ProvenanceConfidenceLevel.medium,
        'low' => ProvenanceConfidenceLevel.low,
        _ => ProvenanceConfidenceLevel.unavailable,
      };
}

abstract final class CosmeticCopy {
  CosmeticCopy._();

  static const disclaimerAr =
      'هذا التحليل تجميلي وإرشادي، وليس تشخيصاً طبياً. قد تختلف النتائج باختلاف الإضاءة والكاميرا وجودة الصورة.';

  static const disclaimerEn =
      'This analysis is cosmetic and informational, not a medical diagnosis. Results may vary based on lighting, camera and image quality.';

  static const skinVitalityIndexAr = 'مؤشر حيوية البشرة';
  static const skinVitalityIndexEn = 'Skin Vitality Index';

  static const skinVitalitySupportingAr =
      'تقدير تجميلي مبني على مؤشرات البشرة الظاهرة في الصورة، وقد تتأثر النتيجة بالإضاءة وجودة الكاميرا.';
}
