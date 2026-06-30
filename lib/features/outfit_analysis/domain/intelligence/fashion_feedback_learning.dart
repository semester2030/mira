/// Phase 28 — learns from accept / reject / purchase signals.
abstract final class FashionFeedbackLearning {
  FashionFeedbackLearning._();

  static Map<String, double> applyFeedback({
    required Map<String, double> current,
    required String pieceId,
    required FeedbackSignal signal,
  }) {
    final next = Map<String, double>.from(current);
    final delta = switch (signal) {
      FeedbackSignal.accepted => 8.0,
      FeedbackSignal.rejected => -12.0,
      FeedbackSignal.purchased => 16.0,
      FeedbackSignal.saved => 6.0,
    };
    next[pieceId] = ((next[pieceId] ?? 0) + delta).clamp(-30, 40);
    return next;
  }

  static Map<String, double> decay(Map<String, double> weights, {double factor = 0.95}) {
    return weights.map((k, v) => MapEntry(k, v * factor));
  }
}

enum FeedbackSignal { accepted, rejected, purchased, saved }
