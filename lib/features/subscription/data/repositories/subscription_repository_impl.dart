import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/config/mira_features.dart';
import '../../domain/entities/subscription_status.dart';
import '../datasources/subscription_api_data_source.dart';
import 'subscription_repository.dart';

class SubscriptionRepositoryImpl implements SubscriptionRepository {
  static const _devPremiumKey = 'mira_dev_premium';

  final SubscriptionApiDataSource? _api;

  SubscriptionRepositoryImpl({SubscriptionApiDataSource? api})
      : _api = MiraApiConfig.useBackend ? (api ?? SubscriptionApiDataSource()) : null;

  @override
  Future<SubscriptionStatus> getStatus() async {
    if (!MiraFeatures.subscriptionsEnabled) {
      return _unlimitedFreeStatus();
    }
    if (MiraApiConfig.useBackend && _api != null) {
      return _api.fetchStatus();
    }
    return _localStatus();
  }

  @override
  Future<SubscriptionStatus> activatePremiumDev() async {
    if (!MiraFeatures.subscriptionsEnabled) {
      return _unlimitedFreeStatus();
    }
    if (MiraApiConfig.useBackend && _api != null) {
      return _api.activatePremiumDev();
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_devPremiumKey, true);
    return _localStatus();
  }

  /// الوضع الحالي: مجاني بالكامل بلا حدود شهرية.
  static SubscriptionStatus _unlimitedFreeStatus() {
    return const SubscriptionStatus(
      plan: 'free',
      status: 'active',
      isPremium: true,
      usage: SubscriptionUsage(
        skinThisMonth: 0,
        outfitThisMonth: 0,
        skinRemaining: 9999,
        outfitRemaining: 9999,
      ),
    );
  }

  Future<SubscriptionStatus> _localStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final isPremium = prefs.getBool(_devPremiumKey) ?? false;
    return SubscriptionStatus(
      plan: isPremium ? 'premium' : 'free',
      status: 'active',
      isPremium: isPremium,
      usage: SubscriptionUsage(
        skinThisMonth: 0,
        outfitThisMonth: 0,
        skinRemaining: isPremium ? 999 : 3,
        outfitRemaining: isPremium ? 999 : 3,
      ),
    );
  }
}
