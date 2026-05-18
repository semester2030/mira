import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

/// Lightweight analytics — wire Firebase Analytics when enabled in pubspec.
abstract final class MiraAnalytics {
  static final _log = Logger(printer: PrettyPrinter(methodCount: 0));

  static void logEvent(String name, [Map<String, Object?>? params]) {
    if (kDebugMode) {
      _log.i('analytics: $name ${params ?? ''}');
    }
    // TODO: FirebaseAnalytics.instance.logEvent(name: name, parameters: params);
  }

  static void screenView(String screenName) => logEvent('screen_view', {'screen': screenName});

  static void analysisCompleted(String type) => logEvent('analysis_completed', {'type': type});

  static void subscriptionViewed() => logEvent('paywall_viewed');

  static void subscriptionStarted() => logEvent('subscription_started');
}
