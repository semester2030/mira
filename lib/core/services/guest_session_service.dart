import 'package:shared_preferences/shared_preferences.dart';

/// Local guest browsing mode (Apple App Store — browse without account).
class GuestSessionService {
  GuestSessionService._();

  static const _key = 'mirra_guest_mode';

  static bool _active = false;

  static bool get isActive => _active;

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _active = prefs.getBool(_key) ?? false;
  }

  static Future<void> enter() async {
    _active = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, true);
  }

  static Future<void> exit() async {
    _active = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, false);
  }
}
