/// Phase 2 — single quality metric. Never invent values.
enum ImageQualityMetricStatus { measured, unavailable }

enum ImageQualityMetricSource {
  localMeasured,
  providerMeasured,
  inferred,
  unavailable,
}

class ImageQualityMetric {
  final String id;
  final double? value;
  final double? confidence;
  final ImageQualityMetricSource source;
  final ImageQualityMetricStatus status;
  final String? unit;
  final List<String> limitations;

  const ImageQualityMetric({
    required this.id,
    this.value,
    this.confidence,
    required this.source,
    required this.status,
    this.unit,
    this.limitations = const [],
  });

  factory ImageQualityMetric.measured({
    required String id,
    required double value,
    double confidence = 0.85,
    ImageQualityMetricSource source = ImageQualityMetricSource.localMeasured,
    String? unit,
    List<String> limitations = const [],
  }) {
    return ImageQualityMetric(
      id: id,
      value: value,
      confidence: confidence,
      source: source,
      status: ImageQualityMetricStatus.measured,
      unit: unit,
      limitations: limitations,
    );
  }

  factory ImageQualityMetric.unavailable({
    required String id,
    List<String> limitations = const [],
  }) {
    return ImageQualityMetric(
      id: id,
      source: ImageQualityMetricSource.unavailable,
      status: ImageQualityMetricStatus.unavailable,
      limitations: limitations.isEmpty
          ? const ['Not measured in this release']
          : limitations,
    );
  }

  bool get isMeasured =>
      status == ImageQualityMetricStatus.measured && value != null;
}
