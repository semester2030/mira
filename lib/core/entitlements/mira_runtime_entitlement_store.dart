import 'package:flutter/foundation.dart';

import 'mira_runtime_entitlement.dart';

/// Process-local entitlement store. Defaults OFF. Clear on logout/account switch.
abstract final class MiraRuntimeEntitlementStore {
  static MiraRuntimeEntitlement _current = MiraRuntimeEntitlement.off;

  /// Device QA only. Ignored in release binaries, so a shipped App Store build
  /// can never bypass server-authoritative entitlement.
  static const bool _localQaOverride = bool.fromEnvironment(
    'MIRA_ENTITLEMENT_LOCAL_QA_OVERRIDE',
    defaultValue: false,
  );

  static bool get _overrideActive => _localQaOverride && !kReleaseMode;

  static MiraRuntimeEntitlement get current => _current.failClosedIfStale;

  static bool get faceExperienceV1 =>
      _overrideActive || current.faceExperienceV1;

  static bool get fashionAdvisorModeB =>
      _overrideActive || current.fashionAdvisorModeB;

  static void apply(MiraRuntimeEntitlement entitlement) {
    _current = entitlement;
  }

  static void clear() {
    _current = MiraRuntimeEntitlement.off;
  }
}
