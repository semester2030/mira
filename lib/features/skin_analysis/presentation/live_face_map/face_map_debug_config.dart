import 'package:flutter/foundation.dart';

/// Developer-only face map debug overlay. Always false in production builds.
abstract final class FaceMapDebugConfig {
  /// Toggle locally during development. Ignored outside [kDebugMode].
  static const bool enabled = false;

  static bool get showOverlay => kDebugMode && enabled;
}
