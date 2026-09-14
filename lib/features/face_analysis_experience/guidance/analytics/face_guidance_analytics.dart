import '../../../../core/analytics/mira_analytics.dart';

/// 9H analytics — semantic keys only; no geometry / image payloads.
abstract final class FaceGuidanceAnalytics {
  FaceGuidanceAnalytics._();

  static void viewed({required String surfaceId, required int itemCount}) {
    MiraAnalytics.logEvent('face_guidance_viewed', {
      'surface_id': surfaceId,
      'item_count': itemCount,
    });
  }

  static void selected(String guidanceId) {
    MiraAnalytics.logEvent('face_guidance_selected', {
      'guidance_id': guidanceId,
    });
  }

  static void reasonOpened(String guidanceId) {
    MiraAnalytics.logEvent('face_guidance_reason_opened', {
      'guidance_id': guidanceId,
    });
  }

  static void actionTapped({
    required String guidanceId,
    required String action,
  }) {
    MiraAnalytics.logEvent('face_guidance_action_tapped', {
      'guidance_id': guidanceId,
      'action': action,
    });
  }

  static void advisorTapped(String guidanceId) {
    MiraAnalytics.logEvent('face_guidance_advisor_tapped', {
      'guidance_id': guidanceId,
    });
  }
}
