import 'dart:io';

import '../../../../../core/privacy/temp_image_cleanup.dart';

/// Short-lived capture copy for Result Mirror continuity (9F).
///
/// Analysis pipelines delete the original temp capture in `finally`.
/// When the Result Mirror flag is ON, [prepareFrom] copies the file before
/// analysis so the mirror can keep visual continuity. [release] must run when
/// the mirror screen disposes (zero local retention).
abstract final class FaceResultMirrorImageHold {
  FaceResultMirrorImageHold._();

  static const _suffix = '.mira_9f_hold';

  /// Copies [sourcePath] to a sibling hold file. Returns hold path or null.
  static Future<String?> prepareFrom(String sourcePath) async {
    if (sourcePath.isEmpty) return null;
    try {
      final src = File(sourcePath);
      if (!await src.exists()) return null;
      final destPath = '$sourcePath$_suffix';
      final dest = File(destPath);
      if (await dest.exists()) {
        await dest.delete();
      }
      await src.copy(destPath);
      return destPath;
    } catch (_) {
      return null;
    }
  }

  static Future<void> release(String? holdPath) async {
    await TempImageCleanup.deleteIfExists(holdPath);
  }
}
