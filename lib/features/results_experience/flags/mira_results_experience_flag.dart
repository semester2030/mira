/// Feature flag: mira_results_experience_v2
/// Default remains [legacy]. Do not activate results_v2 globally.
enum MiraResultsExperienceVariant {
  legacy,
  resultsV2,
}

/// Runtime-resolvable flag for coexistence of legacy report and v2 first surface.
class MiraResultsExperienceFlag {
  const MiraResultsExperienceFlag({
    this.variant = MiraResultsExperienceVariant.legacy,
  });

  final MiraResultsExperienceVariant variant;

  static const String key = 'mira_results_experience_v2';

  /// Production default — always legacy unless explicitly overridden.
  static const MiraResultsExperienceFlag defaults =
      MiraResultsExperienceFlag(variant: MiraResultsExperienceVariant.legacy);

  bool get isResultsV2 => variant == MiraResultsExperienceVariant.resultsV2;
  bool get isLegacy => variant == MiraResultsExperienceVariant.legacy;

  /// Parse remote/config string. Unknown values fail closed to legacy.
  static MiraResultsExperienceFlag fromConfigValue(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'results_v2':
      case 'resultsv2':
      case 'v2':
        return const MiraResultsExperienceFlag(
          variant: MiraResultsExperienceVariant.resultsV2,
        );
      case 'legacy':
      case '':
      default:
        return defaults;
    }
  }
}

/// Process-local flag store (remote config / tests may [apply]).
/// Defaults to legacy. Never enable globally in Phase 8C.
abstract final class MiraResultsExperienceFlagStore {
  static MiraResultsExperienceFlag _current = MiraResultsExperienceFlag.defaults;

  static MiraResultsExperienceFlag get current => _current;

  static void apply(MiraResultsExperienceFlag flag) {
    _current = flag;
  }

  static void applyConfigValue(String? raw) {
    _current = MiraResultsExperienceFlag.fromConfigValue(raw);
  }

  static void resetToDefault() {
    _current = MiraResultsExperienceFlag.defaults;
  }
}
