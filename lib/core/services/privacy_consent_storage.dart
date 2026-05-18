import 'package:shared_preferences/shared_preferences.dart';

/// Persists explicit privacy + camera consent (PDPL-style).
abstract final class PrivacyConsentStorage {
  PrivacyConsentStorage._();

  static const _keyAccepted = 'mira_privacy_accepted_v1';
  static const policyVersion = '1.0';

  static Future<bool> isAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyAccepted) ?? false;
  }

  static Future<void> setAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyAccepted, true);
    await prefs.setString('mira_privacy_policy_version', policyVersion);
    await prefs.setString(
      'mira_privacy_accepted_at',
      DateTime.now().toIso8601String(),
    );
  }

  static Future<void> revoke() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyAccepted);
    await prefs.remove('mira_privacy_policy_version');
    await prefs.remove('mira_privacy_accepted_at');
  }
}
