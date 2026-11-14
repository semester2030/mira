import 'package:shared_preferences/shared_preferences.dart';

/// Persists onboarding completion — UI-only preference.
class OnboardingStorage {
  OnboardingStorage._();

  static const _key = 'mirra_onboarding_complete';

  static Future<bool> isComplete() async {
    // Isolated ops/iPhone proofs only — never set in production builds.
    if (const bool.fromEnvironment('MIRA_SKIP_ONBOARDING')) return true;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key) ?? false;
  }

  static Future<void> setComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, true);
  }
}
