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
    final skinUsed = (json['skinThisMonth'] as num?)?.toInt() ?? 0;
    final outfitUsed = (json['outfitThisMonth'] as num?)?.toInt() ?? 0;
    var skinLeft = (json['skinRemaining'] as num?)?.toInt();
    var outfitLeft = (json['outfitRemaining'] as num?)?.toInt();
    final limits = json['limits'] as Map<String, dynamic>?;
    final skinLimit = (limits?['skinAnalysisPerMonth'] as num?)?.toInt() ?? 3;
    final outfitLimit = (limits?['outfitAnalysisPerMonth'] as num?)?.toInt() ?? 3;
    skinLeft ??= (skinLimit - skinUsed).clamp(0, skinLimit);
    outfitLeft ??= (outfitLimit - outfitUsed).clamp(0, outfitLimit);
    return SubscriptionUsage(
      skinThisMonth: skinUsed,
      outfitThisMonth: outfitUsed,
      skinRemaining: skinLeft,
      outfitRemaining: outfitLeft,
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
    final usageJson = Map<String, dynamic>.from(
      json['usage'] as Map<String, dynamic>? ?? {},
    );
    final limits = json['limits'] as Map<String, dynamic>?;
    if (limits != null) {
      usageJson['limits'] = limits;
    }
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
