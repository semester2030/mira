import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/mira_api_config.dart';
import '../../features/profile/data/datasources/user_api_data_source.dart';
import 'guest_session_service.dart';
import 'privacy_consent_storage.dart';
import '../../features/packages/data/package_credit_storage.dart';

enum AccountDeletionResult {
  success,
  needsRecentLogin,
  failed,
}

/// Deletes the signed-in account (Firebase + API data + local prefs).
abstract final class AccountDeletionService {
  AccountDeletionService._();

  static Future<AccountDeletionResult> deleteAccount() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return AccountDeletionResult.failed;
    }

    try {
      if (MiraApiConfig.useBackend) {
        await UserApiDataSource().deleteAccount();
      }

      await user.delete();
    } on FirebaseAuthException catch (e) {
      if (e.code == 'requires-recent-login') {
        return AccountDeletionResult.needsRecentLogin;
      }
      return AccountDeletionResult.failed;
    } catch (_) {
      return AccountDeletionResult.failed;
    }

    await _clearLocalUserData();
    await GuestSessionService.exit();
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}

    return AccountDeletionResult.success;
  }

  static Future<void> _clearLocalUserData() async {
    await PrivacyConsentStorage.revoke();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('mira_dev_premium');
    await prefs.remove('mirra_guest_mode');
    await PackageCreditStorage.create().then((s) => s.clear());
  }
}
