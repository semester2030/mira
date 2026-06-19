import 'package_type.dart';

/// Active credit balance for a signed-in user (persisted locally).
class UserPackage {
  final PackageType packageType;
  final int skinCredits;
  final int smartOutfitCredits;
  final DateTime purchasedAt;
  final DateTime expiresAt;
  final bool isActive;

  const UserPackage({
    required this.packageType,
    required this.skinCredits,
    required this.smartOutfitCredits,
    required this.purchasedAt,
    required this.expiresAt,
    this.isActive = true,
  });

  static UserPackage get empty => UserPackage(
        packageType: PackageType.starter,
        skinCredits: 0,
        smartOutfitCredits: 0,
        purchasedAt: _epoch,
        expiresAt: _epoch,
        isActive: false,
      );

  static final _epoch = DateTime.fromMillisecondsSinceEpoch(0);

  bool get hasAnyCredits => skinCredits > 0 || smartOutfitCredits > 0;

  bool isExpiredAt(DateTime now) => !expiresAt.isAfter(now);

  bool isValidAt(DateTime now) => isActive && !isExpiredAt(now);

  bool hasSkinCreditsAt(DateTime now) => isValidAt(now) && skinCredits > 0;

  bool hasSmartOutfitCreditsAt(DateTime now) => isValidAt(now) && smartOutfitCredits > 0;

  /// Unlimited quick outfit — always available when package system is on.
  bool get quickOutfitAlwaysFree => true;

  bool get hasFullHistoryAccess =>
      packageType == PackageType.plus || packageType == PackageType.elite;

  bool get hasAdvancedRecommendations =>
      packageType == PackageType.plus || packageType == PackageType.elite;

  bool get hasPriorityProcessing => packageType == PackageType.elite;

  bool get hasSeasonalRecommendations => packageType == PackageType.elite;

  bool get hasPremiumBeautyInsights => packageType == PackageType.elite;

  UserPackage copyWith({
    PackageType? packageType,
    int? skinCredits,
    int? smartOutfitCredits,
    DateTime? purchasedAt,
    DateTime? expiresAt,
    bool? isActive,
  }) {
    return UserPackage(
      packageType: packageType ?? this.packageType,
      skinCredits: skinCredits ?? this.skinCredits,
      smartOutfitCredits: smartOutfitCredits ?? this.smartOutfitCredits,
      purchasedAt: purchasedAt ?? this.purchasedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      isActive: isActive ?? this.isActive,
    );
  }

  Map<String, dynamic> toJson() => {
        'packageType': packageType.id,
        'skinCredits': skinCredits,
        'smartOutfitCredits': smartOutfitCredits,
        'purchasedAt': purchasedAt.toIso8601String(),
        'expiresAt': expiresAt.toIso8601String(),
        'isActive': isActive,
      };

  factory UserPackage.fromJson(Map<String, dynamic> json) {
    final type = packageTypeFromId(json['packageType'] as String?) ?? PackageType.starter;
    return UserPackage(
      packageType: type,
      skinCredits: (json['skinCredits'] as num?)?.toInt() ?? 0,
      smartOutfitCredits: (json['smartOutfitCredits'] as num?)?.toInt() ?? 0,
      purchasedAt: DateTime.tryParse(json['purchasedAt'] as String? ?? '') ?? _epoch,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ?? _epoch,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
