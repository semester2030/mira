import '../../../../core/analytics/mira_analytics.dart';

/// Results Experience analytics — no intelligence payloads.
abstract final class ResultsV2Analytics {
  static void viewed({required String analysisId}) =>
      MiraAnalytics.logEvent('results_v2_viewed', {'analysis_id': analysisId});

  static void priorityOpened({required String priorityId}) =>
      MiraAnalytics.logEvent('result_priority_opened', {'priority_id': priorityId});

  static void todayActionClicked({required String actionId}) =>
      MiraAnalytics.logEvent('result_today_action_clicked', {'action_id': actionId});

  static void routineOpened() => MiraAnalytics.logEvent('result_routine_opened');

  static void progressOpened() => MiraAnalytics.logEvent('result_progress_opened');

  static void advisorOpened() => MiraAnalytics.logEvent('result_advisor_opened');

  static void detailsOpened() => MiraAnalytics.logEvent('result_details_opened');

  static void retakeClicked() => MiraAnalytics.logEvent('result_retake_clicked');

  static void summaryAbandoned() =>
      MiraAnalytics.logEvent('result_summary_abandoned');

  // Phase 8D
  static void metricsViewed() => MiraAnalytics.logEvent('result_metrics_viewed');

  static void metricOpened({required String metricId}) =>
      MiraAnalytics.logEvent('result_metric_opened', {'metric_id': metricId});

  static void metricAdvisorOpened({required String metricId}) =>
      MiraAnalytics.logEvent(
        'result_metric_advisor_opened',
        {'metric_id': metricId},
      );

  static void metricUnavailable({required String metricId}) =>
      MiraAnalytics.logEvent(
        'result_metric_unavailable',
        {'metric_id': metricId},
      );

  static void skinMapViewed() =>
      MiraAnalytics.logEvent('result_skin_map_viewed');

  static void skinMapInfoOpened() =>
      MiraAnalytics.logEvent('result_skin_map_info_opened');

  static void skinMapConcernSelected({required String concernId}) =>
      MiraAnalytics.logEvent(
        'result_skin_map_concern_selected',
        {'concern_id': concernId},
      );

  static void skinMapAdvisorOpened({required String concernId}) =>
      MiraAnalytics.logEvent(
        'result_skin_map_advisor_opened',
        {'concern_id': concernId},
      );

  static void skinMapUnavailable() =>
      MiraAnalytics.logEvent('result_skin_map_unavailable');

  // Phase 8E
  static void routineViewed() =>
      MiraAnalytics.logEvent('result_routine_viewed');

  static void routinePeriodChanged({required String period}) =>
      MiraAnalytics.logEvent(
        'result_routine_period_changed',
        {'period': period},
      );

  static void routineStepOpened({required String stepId}) =>
      MiraAnalytics.logEvent(
        'result_routine_step_opened',
        {'step_id': stepId},
      );

  static void routineStepCompleted({required String stepId}) =>
      MiraAnalytics.logEvent(
        'result_routine_step_completed',
        {'step_id': stepId},
      );

  static void routineStepUncompleted({required String stepId}) =>
      MiraAnalytics.logEvent(
        'result_routine_step_uncompleted',
        {'step_id': stepId},
      );

  static void weeklyAdjustmentViewed() =>
      MiraAnalytics.logEvent('result_weekly_adjustment_viewed');

  static void avoidanceViewed() =>
      MiraAnalytics.logEvent('result_avoidance_viewed');

  static void routineAdvisorOpened() =>
      MiraAnalytics.logEvent('result_routine_advisor_opened');

  static void routineRetakeClicked() =>
      MiraAnalytics.logEvent('result_routine_retake_clicked');

  static void routineUnavailable() =>
      MiraAnalytics.logEvent('result_routine_unavailable');
}
