import 'package:flutter/foundation.dart';

/// Removable measurement probe for capture/analysis latency study.
/// Logs only — does not change product gates or thresholds.
/// Remove or gate-off after CKMEAS evidence package closes.
abstract final class MiraMeasureTrace {
  MiraMeasureTrace._();

  static const probeTag = 'CKMEAS-20260916B';
  static final Stopwatch _mono = Stopwatch()..start();

  static String runId = 'unset';
  static int sessionSeq = 0;
  static int attemptSeq = 0;

  static int get monoMs => _mono.elapsedMilliseconds;

  static void beginRun(String id) {
    runId = id;
    sessionSeq = 0;
    attemptSeq = 0;
    span('RUN_BEGIN', detail: id);
  }

  static void beginSession() {
    sessionSeq += 1;
    span('SESSION_BEGIN', detail: 'session=$sessionSeq');
  }

  static void beginAttempt({required String side, required int pair}) {
    attemptSeq += 1;
    span(
      'ATTEMPT_BEGIN',
      detail: 'side=$side pair=$pair attempt=$attemptSeq',
    );
  }

  static void span(String name, {String? detail, int? t0Ms}) {
    final now = monoMs;
    final delta = t0Ms == null ? '' : ' deltaMs=${now - t0Ms}';
    final d = detail == null ? '' : ' $detail';
    // ignore: avoid_print
    print(
      'MiraMeasure probe=$probeTag run=$runId '
      'session=$sessionSeq attempt=$attemptSeq '
      'monoMs=$now span=$name$delta$d',
    );
    if (kDebugMode) {
      debugPrint(
        'MiraMeasure probe=$probeTag run=$runId '
        'session=$sessionSeq attempt=$attemptSeq '
        'monoMs=$now span=$name$delta$d',
      );
    }
  }
}
