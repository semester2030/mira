/// Temporal sample for stability evaluation.
class FaceCaptureStabilitySample {
  final DateTime timestamp;
  final double centerX;
  final double centerY;

  const FaceCaptureStabilitySample({
    required this.timestamp,
    required this.centerX,
    required this.centerY,
  });
}

/// Rolling history for stability — presentation-owned, not Face Intelligence.
class FaceCaptureStabilityHistory {
  final List<FaceCaptureStabilitySample> _samples = [];

  List<FaceCaptureStabilitySample> get samples =>
      List.unmodifiable(_samples);

  void clear() => _samples.clear();

  void push(FaceCaptureStabilitySample sample, {required Duration keep}) {
    _samples.add(sample);
    final cutoff = sample.timestamp.subtract(keep);
    _samples.removeWhere((s) => s.timestamp.isBefore(cutoff));
  }

  /// Max pairwise center delta within window; null if insufficient samples.
  double? maxCenterDelta({required Duration window, required DateTime now}) {
    final recent = _samples
        .where((s) => !now.difference(s.timestamp).isNegative &&
            now.difference(s.timestamp) <= window)
        .toList();
    if (recent.length < 2) return null;
    var max = 0.0;
    for (var i = 1; i < recent.length; i++) {
      final dx = (recent[i].centerX - recent[i - 1].centerX).abs();
      final dy = (recent[i].centerY - recent[i - 1].centerY).abs();
      final d = dx > dy ? dx : dy;
      if (d > max) max = d;
    }
    return max;
  }
}
