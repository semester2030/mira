/// Purchasable MIRA analysis packages (credit economy).
enum PackageType {
  starter,
  plus,
  elite,
}

extension PackageTypeX on PackageType {
  String get id => name;

  String get labelAr => switch (this) {
        PackageType.starter => 'Starter',
        PackageType.plus => 'Plus',
        PackageType.elite => 'Elite',
      };

  String get titleAr => switch (this) {
        PackageType.starter => 'باقة Starter',
        PackageType.plus => 'باقة Plus',
        PackageType.elite => 'باقة Elite',
      };
}

PackageType? packageTypeFromId(String? raw) {
  return switch (raw) {
    'starter' => PackageType.starter,
    'plus' => PackageType.plus,
    'elite' => PackageType.elite,
    _ => null,
  };
}
