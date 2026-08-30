/// Engineering Laws #35 and #36 — Results Presentation Layer only.
/// Compatible with frozen Laws #1–#34; does not change intelligence ownership.
abstract final class EngineeringLaw35 {
  /// Every result presented to the user must have:
  /// one clear meaning, one evidence source, one confidence state,
  /// one recommended action, and one presentation owner.
  static const int number = 35;
  static const String statement =
      'Every result presented to the user must have one clear meaning, '
      'one evidence source, one confidence state, one recommended action, '
      'and one presentation owner.';
}

abstract final class EngineeringLaw36 {
  /// Public Results Experience must never expose provider/canonical/raw/trace/
  /// internal version/MCE/mapping/engine metadata terminology.
  static const int number = 36;
  static const String statement =
      'The public Results Experience must never expose provider, canonical, '
      'raw-score, trace, internal version, implementation, MCE, mapping, '
      'or engine metadata terminology.';
}
