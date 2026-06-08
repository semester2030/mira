class UserPreferences {
  final String locale;
  final int? birthYear;

  const UserPreferences({
    required this.locale,
    this.birthYear,
  });

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    final birthRaw = json['birthYear'];
    return UserPreferences(
      locale: json['locale'] as String? ?? 'ar',
      birthYear: birthRaw is num ? birthRaw.toInt() : null,
    );
  }
}
