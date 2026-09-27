import 'dart:io';

import '../../../../../core/privacy/temp_image_cleanup.dart';

/// Short-lived capture copy for active Skin result continuity.
///
/// Analysis pipelines delete original / aligned temps after success.
/// [prepareFrom] copies the Perfect-input file into a session hold so
/// Face Explorer / Apple Matte keep the SAME pixel grid. Canonical owner
/// of the path is [AnalysisSession.lastEphemeralFacePath].
/// [release] runs when the active result session ends (zero durable storage).
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
