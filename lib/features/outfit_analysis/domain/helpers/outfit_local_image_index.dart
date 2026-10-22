import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Maps saved report / fingerprint → retained local outfit view path.
/// Server snapshots store no image; wardrobe reads these local paths only.
/// Keys are scoped by Firebase uid — never read another account's mapping.
abstract final class OutfitLocalImageIndex {
  static const _prefix = 'mira_outfit_view_';

  static String? get currentUid {
    final uid = FirebaseAuth.instance.currentUser?.uid.trim();
    if (uid == null || uid.isEmpty) return null;
    return uid;
  }

  static String _scope() => currentUid ?? 'anon';

  static String _prefKey(String key) => '$_prefix${_scope()}_$key';

  static String _legacyKey(String key) => '$_prefix$key';

  /// Persist a local view path for the signed-in account.
  /// Migrates a legacy unscoped entry only when it points at the same path
  /// being remembered now (ownership proven by this authenticated write).
  static Future<void> remember({
    required String key,
    required String absolutePath,
  }) async {
    final trimmed = key.trim();
    if (trimmed.isEmpty || absolutePath.trim().isEmpty) return;
    if (!File(absolutePath).existsSync()) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey(trimmed), absolutePath);
    final legacy = prefs.getString(_legacyKey(trimmed));
    if (legacy != null && legacy == absolutePath) {
      await prefs.remove(_legacyKey(trimmed));
    }
  }

  static Future<String?> pathFor(String? key) async {
    if (key == null || key.trim().isEmpty) return null;
    final trimmed = key.trim();
    final prefs = await SharedPreferences.getInstance();
    final scoped = prefs.getString(_prefKey(trimmed));
    if (scoped != null && scoped.isNotEmpty && File(scoped).existsSync()) {
      return scoped;
    }
    return null;
  }
}
