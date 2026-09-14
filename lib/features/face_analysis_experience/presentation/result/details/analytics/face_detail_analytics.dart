import '../../../../../../core/analytics/mira_analytics.dart';

/// 9G analytics — semantic keys only, no geometry / image payloads.
abstract final class FaceDetailAnalytics {
  FaceDetailAnalytics._();

  static void opened({
    required String detailKey,
    required String category,
  }) {
    MiraAnalytics.logEvent('face_detail_opened', {
      'detail_key': detailKey,
      'category': category,
    });
  }

  static void closed({required String detailKey}) {
    MiraAnalytics.logEvent('face_detail_closed', {'detail_key': detailKey});
  }

  static void regionSelected(String regionKey) {
    MiraAnalytics.logEvent('face_region_selected', {'region': regionKey});
  }

  static void insightSelected(String insightKey) {
    MiraAnalytics.logEvent('face_insight_selected', {
      'insight_key': insightKey,
    });
  }

  static void advisorTapped(String detailKey) {
    MiraAnalytics.logEvent('face_detail_advisor_tapped', {
      'detail_key': detailKey,
    });
  }

  static void retakeTapped(String detailKey) {
    MiraAnalytics.logEvent('face_detail_retake_tapped', {
      'detail_key': detailKey,
    });
  }
}
