import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/subscription/domain/entities/subscription_status.dart';

void main() {
  test('free plan blocks when remaining is zero', () {
    const status = SubscriptionStatus(
      plan: 'free',
      status: 'active',
      isPremium: false,
      usage: SubscriptionUsage(
        skinThisMonth: 3,
        outfitThisMonth: 3,
        skinRemaining: 0,
        outfitRemaining: 0,
      ),
    );
    expect(status.canAnalyzeSkin(), isFalse);
    expect(status.canAnalyzeOutfit(), isFalse);
  });

  test('premium allows unlimited', () {
    const status = SubscriptionStatus(
      plan: 'premium',
      status: 'active',
      isPremium: true,
      usage: SubscriptionUsage(
        skinThisMonth: 100,
        outfitThisMonth: 100,
        skinRemaining: 0,
        outfitRemaining: 0,
      ),
    );
    expect(status.canAnalyzeSkin(), isTrue);
    expect(status.canAnalyzeOutfit(), isTrue);
  });

  test('parses API JSON', () {
    final status = SubscriptionStatus.fromJson({
      'plan': 'free',
      'status': 'active',
      'isPremium': false,
      'usage': {
        'skinThisMonth': 1,
        'outfitThisMonth': 2,
        'skinRemaining': 2,
        'outfitRemaining': 1,
      },
    });
    expect(status.usage.skinRemaining, 2);
    expect(status.canAnalyzeSkin(), isTrue);
  });
}
