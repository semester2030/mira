import 'dart:io';

/// Deletes temporary capture files after analysis (zero local retention policy).
abstract final class TempImageCleanup {
  TempImageCleanup._();

  static Future<void> deleteIfExists(String? path) async {
    if (path == null || path.isEmpty) return;
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {
      // Best-effort — do not block UX on cleanup failure.
    }
  }
}
