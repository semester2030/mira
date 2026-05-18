import '../../domain/entities/subscription_status.dart';

abstract class SubscriptionRepository {
  Future<SubscriptionStatus> getStatus();
  Future<SubscriptionStatus> activatePremiumDev();
}
