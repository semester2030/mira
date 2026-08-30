import '../../../../core/analytics/mira_analytics.dart';

/// 9J analytics — semantic keys only; no geometry/image payloads.
abstract final class FaceHistoryAnalytics {
  FaceHistoryAnalytics._();

  static void historyOpened() {
    MiraAnalytics.logEvent('face_history_opened', const {});
  }

  static void entryOpened(String entryKey) {
    MiraAnalytics.logEvent('face_history_entry_opened', {
      'entry_key': entryKey,
    });
  }

  static void comparisonOpened(String gate) {
    MiraAnalytics.logEvent('face_comparison_opened', {'gate': gate});
  }

  static void retakeStarted(String source) {
    MiraAnalytics.logEvent('face_retake_started', {'source': source});
  }

  static void retakeCompleted() {
    MiraAnalytics.logEvent('face_retake_completed', const {});
  }
}
