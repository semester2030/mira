class SubscriptionUsage {
  final int skinThisMonth;
  final int outfitThisMonth;
  final int skinRemaining;
  final int outfitRemaining;

  const SubscriptionUsage({
    required this.skinThisMonth,
    required this.outfitThisMonth,
    required this.skinRemaining,
    required this.outfitRemaining,
  });

  factory SubscriptionUsage.fromJson(Map<String, dynamic> json) {
    return SubscriptionUsage(
      skinThisMonth: (json['skinThisMonth'] as num?)?.toInt() ?? 0,
      outfitThisMonth: (json['outfitThisMonth'] as num?)?.toInt() ?? 0,
      skinRemaining: (json['skinRemaining'] as num?)?.toInt() ?? 0,
      outfitRemaining: (json['outfitRemaining'] as num?)?.toInt() ?? 0,
    );
  }
}

class SubscriptionStatus {
  final String plan;
  final String status;
  final bool isPremium;
  final DateTime? currentPeriodEnd;
  final SubscriptionUsage usage;

  const SubscriptionStatus({
    required this.plan,
    required this.status,
    required this.isPremium,
    this.currentPeriodEnd,
    required this.usage,
  });

  factory SubscriptionStatus.fromJson(Map<String, dynamic> json) {
    final usageJson = json['usage'] as Map<String, dynamic>? ?? {};
    return SubscriptionStatus(
      plan: json['plan'] as String? ?? 'free',
      status: json['status'] as String? ?? 'active',
      isPremium: json['isPremium'] as bool? ?? false,
      currentPeriodEnd: json['currentPeriodEnd'] != null
          ? DateTime.tryParse(json['currentPeriodEnd'] as String)
          : null,
      usage: SubscriptionUsage.fromJson(usageJson),
    );
  }

  bool canAnalyzeSkin({bool isGuest = false}) =>
      isGuest || isPremium || usage.skinRemaining > 0;

  bool canAnalyzeOutfit({bool isGuest = false}) =>
      isGuest || isPremium || usage.outfitRemaining > 0;
}
