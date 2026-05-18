import 'package:shared_preferences/shared_preferences.dart';

/// Persists onboarding completion — UI-only preference.
class OnboardingStorage {
  OnboardingStorage._();

  static const _key = 'mirra_onboarding_complete';

  static Future<bool> isComplete() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key) ?? false;
  }

  static Future<void> setComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, true);
  }
}
