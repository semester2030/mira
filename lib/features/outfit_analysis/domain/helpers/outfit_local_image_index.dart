import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

/// Maps saved report / fingerprint → retained local outfit view path.
/// Server snapshots store no image; wardrobe reads these local paths only.
abstract final class OutfitLocalImageIndex {
  static const _prefix = 'mira_outfit_view_';

  static Future<void> remember({
    required String key,
    required String absolutePath,
  }) async {
    final trimmed = key.trim();
    if (trimmed.isEmpty || absolutePath.trim().isEmpty) return;
    if (!File(absolutePath).existsSync()) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_prefix$trimmed', absolutePath);
  }

  static Future<String?> pathFor(String? key) async {
    if (key == null || key.trim().isEmpty) return null;
    final prefs = await SharedPreferences.getInstance();
    final path = prefs.getString('$_prefix${key.trim()}');
    if (path == null || path.isEmpty) return null;
    if (!File(path).existsSync()) return null;
    return path;
  }
}
