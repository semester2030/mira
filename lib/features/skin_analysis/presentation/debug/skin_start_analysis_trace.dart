import 'package:flutter/foundation.dart';

/// Temporary physical-iPhone start-analysis tracer.
/// Enable: `--dart-define=MIRA_SKIN_START_TRACE=true`
/// Never logs tokens, keys, or face bytes.
abstract final class SkinStartAnalysisTrace {
  SkinStartAnalysisTrace._();

  static const bool enabled = bool.fromEnvironment(
    'MIRA_SKIN_START_TRACE',
    defaultValue: false,
  );

  static String? failureStage;
  static String? sanitizedError;
  static String? requestHost;
  static int? httpStatus;

  static void reset() {
    failureStage = null;
    sanitizedError = null;
    requestHost = null;
    httpStatus = null;
  }

  static void mark(String stage, {String? detail}) {
    if (!enabled && !kDebugMode) return;
    final extra = detail == null || detail.isEmpty ? '' : ' $detail';
    // ignore: avoid_print
    print('SKIN_START_TRACE $stage$extra');
  }

  static void fail(String stage, Object error) {
    failureStage = stage;
    sanitizedError = _sanitize(error);
    mark('EXACT_FAILURE_STAGE=$stage');
    mark('SANITIZED_ERROR=$sanitizedError');
  }

  static String _sanitize(Object error) {
    var s = error.toString();
    s = s.replaceAll(RegExp(r'Bearer\s+\S+', caseSensitive: false), 'Bearer [redacted]');
    s = s.replaceAll(RegExp(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'), '[jwt]');
    if (s.length > 280) s = '${s.substring(0, 280)}…';
    return s;
  }
}
