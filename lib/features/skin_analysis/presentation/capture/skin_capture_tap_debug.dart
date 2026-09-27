import 'package:flutter/foundation.dart';

/// DEBUG-ONLY capture tap trace — no images, tokens, or PII.
///
/// Enable: `--dart-define=MIRA_SKIN_CAPTURE_TAP_DEBUG=true`
abstract final class SkinCaptureTapDebug {
  SkinCaptureTapDebug._();

  static const _flag = bool.fromEnvironment(
    'MIRA_SKIN_CAPTURE_TAP_DEBUG',
    defaultValue: false,
  );

  static bool get enabled => _flag;

  static void log(String event, [Map<String, Object?> fields = const {}]) {
    if (!enabled) return;
    final payload = fields.entries.map((e) => '${e.key}=${e.value}').join(' ');
    debugPrint('SKIN_CAPTURE_TAP $event $payload');
  }
}
