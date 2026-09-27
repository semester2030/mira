import 'dart:io';

import 'temp_image_cleanup.dart';

/// Process-local registry of ephemeral analysis face holds.
///
/// Never persists to Firestore / Storage / Postgres. Cleared on logout,
/// account switch, and explicit session end.
abstract final class EphemeralAnalysisFaceRegistry {
  EphemeralAnalysisFaceRegistry._();

  static final Set<String> _activeHolds = <String>{};

  static void register(String? path) {
    if (path == null || path.isEmpty) return;
    _activeHolds.add(path);
  }

  static void unregister(String? path) {
    if (path == null || path.isEmpty) return;
    _activeHolds.remove(path);
  }

  static Future<void> release(String? path) async {
    unregister(path);
    await TempImageCleanup.deleteIfExists(path);
  }

  /// Best-effort wipe of every registered hold (logout / account switch).
  static Future<void> releaseAll() async {
    final snapshot = List<String>.from(_activeHolds);
    _activeHolds.clear();
    for (final p in snapshot) {
      await TempImageCleanup.deleteIfExists(p);
    }
  }

  static int get activeCount => _activeHolds.length;

  /// True if [path] looks like a local ephemeral hold / temp capture.
  static bool isEphemeralLocalPath(String? path) {
    if (path == null || path.isEmpty) return false;
    if (path.startsWith('http://') || path.startsWith('https://')) return false;
    return path.contains('.mira_9f_hold') ||
        path.contains('mira_face_') ||
        File(path).isAbsolute;
  }
}
