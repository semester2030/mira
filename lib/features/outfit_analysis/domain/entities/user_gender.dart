/// User gender for context-aware outfit recommendations.
enum UserGender {
  male,
  female;

  bool get isMale => this == UserGender.male;

  bool get isFemale => this == UserGender.female;
}
