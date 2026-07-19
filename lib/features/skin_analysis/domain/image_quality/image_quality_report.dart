import '../entities/capture_quality_signals.dart';
import 'image_quality_metric.dart';

enum ImageQualityVerdict {
  excellent,
  acceptable,
  poor,
  blocked,
}

/// Versioned quality→confidence mapping id.
const kQualityConfidenceVersion = 'qc-v1.1';
class ImageQualityReport {
  final List<ImageQualityMetric> metrics;
  final ImageQualityVerdict verdict;
  final String calculationVersion;
  final String messageAr;
  final String messageEn;
  final CaptureQualitySignals? captureSignals;
  final int overallConfidencePercent;
  final List<String> blockingReasons;

  const ImageQualityReport({
    required this.metrics,
    required this.verdict,
    required this.calculationVersion,
    required this.messageAr,
    required this.messageEn,
    this.captureSignals,
    required this.overallConfidencePercent,
    this.blockingReasons = const [],
  });

  bool get mayProceedToProvider =>
      verdict == ImageQualityVerdict.excellent ||
      verdict == ImageQualityVerdict.acceptable;

  ImageQualityMetric? metric(String id) {
    for (final m in metrics) {
      if (m.id == id) return m;
    }
    return null;
  }
}
