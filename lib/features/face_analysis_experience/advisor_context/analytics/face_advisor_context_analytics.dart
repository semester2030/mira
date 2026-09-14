import '../../../../core/analytics/mira_analytics.dart';
import '../contracts/face_advisor_context.dart';

/// 9I analytics — semantic keys only; no geometry / image / evidence contents.
abstract final class FaceAdvisorContextAnalytics {
  FaceAdvisorContextAnalytics._();

  static void opened(FaceAdvisorContext ctx) {
    MiraAnalytics.logEvent('face_advisor_opened', {
      'context_type': ctx.contextType.name,
      'analysis_id': ctx.analysisId,
    });
  }

  static void contextType(FaceAdvisorContextType type) {
    MiraAnalytics.logEvent('face_advisor_context_type', {
      'context_type': type.name,
    });
  }

  static void questionSent({
    required FaceAdvisorContextType type,
    required String safeResultKey,
  }) {
    MiraAnalytics.logEvent('face_advisor_question_sent', {
      'context_type': type.name,
      'result_key': safeResultKey,
    });
  }

  static void returned(FaceAdvisorContextType? type) {
    MiraAnalytics.logEvent('face_advisor_returned', {
      if (type != null) 'context_type': type.name,
    });
  }
}
