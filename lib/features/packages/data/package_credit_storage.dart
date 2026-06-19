import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/entities/user_package.dart';

/// Local persistence for credit packages (Flutter-only — no backend).
class PackageCreditStorage {
  PackageCreditStorage(this._prefs);

  static const _key = 'mira_user_package_v1';

  final SharedPreferences _prefs;

  static Future<PackageCreditStorage> create() async {
    final prefs = await SharedPreferences.getInstance();
    return PackageCreditStorage(prefs);
  }

  UserPackage? load() {
    final raw = _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return UserPackage.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(UserPackage package) async {
    await _prefs.setString(_key, jsonEncode(package.toJson()));
  }

  Future<void> clear() async {
    await _prefs.remove(_key);
  }
}
