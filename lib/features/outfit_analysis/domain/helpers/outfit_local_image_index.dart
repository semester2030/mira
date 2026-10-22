import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Maps saved report / fingerprint → retained local outfit view path.
/// Server snapshots store no image; wardrobe reads these local paths only.
/// Keys are scoped by Firebase uid when signed in so accounts do not collide.
abstract final class OutfitLocalImageIndex {
  static const _prefix = 'mira_outfit_view_';

  static String _scope() {
    final uid = FirebaseAuth.instance.currentUser?.uid.trim();
    if (uid == null || uid.isEmpty) return 'anon';
    return uid;
  }

  static String _prefKey(String key) => '$_prefix${_scope()}_$key';

  static Future<void> remember({
    required String key,
    required String absolutePath,
  }) async {
    final trimmed = key.trim();
    if (trimmed.isEmpty || absolutePath.trim().isEmpty) return;
    if (!File(absolutePath).existsSync()) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey(trimmed), absolutePath);
    // Legacy unscoped key — keep readable for reports saved before RC13.
    await prefs.setString('$_prefix$trimmed', absolutePath);
  }

  static Future<String?> pathFor(String? key) async {
    if (key == null || key.trim().isEmpty) return null;
    final trimmed = key.trim();
    final prefs = await SharedPreferences.getInstance();
    for (final pref in [_prefKey(trimmed), '$_prefix$trimmed']) {
      final path = prefs.getString(pref);
      if (path == null || path.isEmpty) continue;
      if (File(path).existsSync()) return path;
    }
    return null;
  }
}
