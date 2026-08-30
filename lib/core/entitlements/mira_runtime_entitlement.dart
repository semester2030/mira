/// Snapshot from `GET /entitlements/runtime`.
class MiraRuntimeEntitlement {
  const MiraRuntimeEntitlement({
    required this.faceExperienceV1,
    required this.fashionAdvisorModeB,
    required this.version,
    this.fetchedAt,
  });

  final bool faceExperienceV1;
  final bool fashionAdvisorModeB;
  final String version;
  final DateTime? fetchedAt;

  static const MiraRuntimeEntitlement off = MiraRuntimeEntitlement(
    faceExperienceV1: false,
    fashionAdvisorModeB: false,
    version: 'unloaded',
  );

  /// Governed short lifetime — expired/invalid → treat as OFF.
  static const Duration cacheTtl = Duration(minutes: 5);

  bool get isExpired {
    final at = fetchedAt;
    if (at == null) return true;
    return DateTime.now().difference(at) > cacheTtl;
  }

  MiraRuntimeEntitlement get failClosedIfStale =>
      isExpired ? MiraRuntimeEntitlement.off : this;

  factory MiraRuntimeEntitlement.fromJson(Map<String, dynamic> json) {
    return MiraRuntimeEntitlement(
      faceExperienceV1: json['faceExperienceV1'] == true,
      fashionAdvisorModeB: json['fashionAdvisorModeB'] == true,
      version: (json['version'] as String?)?.trim().isNotEmpty == true
          ? json['version'] as String
          : 'unknown',
      fetchedAt: DateTime.now(),
    );
  }
}
