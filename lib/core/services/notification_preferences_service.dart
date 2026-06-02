import 'package:shared_preferences/shared_preferences.dart';

/// تفضيلات إشعارات محلية (قبل ربط FCM لاحقاً).
abstract final class NotificationPreferencesService {
  NotificationPreferencesService._();

  static const _keyAnalysis = 'mirra_notify_analysis';
  static const _keyTips = 'mirra_notify_tips';
  static const _keyOffers = 'mirra_notify_offers';

  static Future<bool> get analysisReminders async =>
      (await SharedPreferences.getInstance()).getBool(_keyAnalysis) ?? true;

  static Future<bool> get tipsReminders async =>
      (await SharedPreferences.getInstance()).getBool(_keyTips) ?? true;

  static Future<bool> get offers async =>
      (await SharedPreferences.getInstance()).getBool(_keyOffers) ?? false;

  static Future<void> setAnalysisReminders(bool value) async {
    await (await SharedPreferences.getInstance()).setBool(_keyAnalysis, value);
  }

  static Future<void> setTipsReminders(bool value) async {
    await (await SharedPreferences.getInstance()).setBool(_keyTips, value);
  }

  static Future<void> setOffers(bool value) async {
    await (await SharedPreferences.getInstance()).setBool(_keyOffers, value);
  }
}
