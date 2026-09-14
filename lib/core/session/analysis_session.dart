import 'package:flutter/foundation.dart';

import '../../features/outfit_analysis/domain/entities/outfit_analysis.dart';
import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/outfit_analysis/domain/entities/user_gender.dart';
import '../../features/results_experience/domain/perfect_mask_session.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

/// Sanitized proof that real analysis created/propagated PerfectMaskSession.
/// No payloads, URLs, or face bytes.
class PerfectMaskCreateProof {
  const PerfectMaskCreateProof({
    required this.endpoint,
    required this.rawPresent,
    required this.rawCount,
    required this.withBytesCount,
    required this.providerKeys,
    required this.sessionCreated,
    this.skipReason,
  });

  final String endpoint;
  final bool rawPresent;
  final int rawCount;
  final int withBytesCount;
  final List<String> providerKeys;
  final bool sessionCreated;
  final String? skipReason;

  String get hudLine {
    if (skipReason != null && !rawPresent) {
      return 'CREATE skipped=$skipReason';
    }
    return 'CREATE raw=${rawPresent ? rawCount : 0} '
        'bytesKeys=$withBytesCount '
        'session=${sessionCreated ? "YES" : "NO"}';
  }
}

/// In-memory session for chaining skin → outfit → unified recommendations.
abstract final class AnalysisSession {
  static SkinReport? lastSkin;
  static OutfitReport? lastOutfit;
  static OutfitAnalysis? lastOutfitIntelligence;
  static String? lastRecolorAttemptId;
  static UserGender userGender = UserGender.female;
  /// Ephemeral Perfect HD masks for current Skin analysis only — never History.
  /// Canonical owner of PerfectMaskSession for the active Skin result.
  static PerfectMaskSession? lastPerfectMasks;

  /// Last real-analysis mask creation proof (sanitized).
  static PerfectMaskCreateProof? lastMaskCreateProof;

  static void setSkin(SkinReport report) => lastSkin = report;

  static void recordMaskCreateProof(PerfectMaskCreateProof proof) {
    lastMaskCreateProof = proof;
    // Always print — profile/release physical proof (no secrets/payloads).
    // ignore: avoid_print
    print(
      'MASK_SESSION_CREATE endpoint=${proof.endpoint} '
      'rawPresent=${proof.rawPresent} rawCount=${proof.rawCount} '
      'withBytes=${proof.withBytesCount} '
      'sessionCreated=${proof.sessionCreated} '
      'keys=${proof.providerKeys.join(",")} '
      'skip=${proof.skipReason ?? "-"}',
    );
  }

  static void setPerfectMasks(PerfectMaskSession? session) {
    if (identical(lastPerfectMasks, session)) return;
    final previous = lastPerfectMasks;
    lastPerfectMasks = session;
    // Dispose only when replacing with a different session (new analysis).
    // Detach-on-leave must not wipe bytes while another route still holds them.
    if (previous != null && !identical(previous, session)) {
      previous.dispose();
    }
    assert(() {
      final n = session?.providersPresent().length ?? 0;
      final b = session?.providersWithMaskBytes().length ?? 0;
      debugPrint(
        'PERFECT_MASK_SESSION_OWNER set '
        'present=$n withBytes=$b hasAny=${session?.hasAnyMask == true}',
      );
      return true;
    }());
  }

  /// Drop owner pointer without disposing — result route finished; holders may remain.
  static void detachPerfectMasksIfCurrent(PerfectMaskSession? session) {
    if (!identical(lastPerfectMasks, session)) return;
    lastPerfectMasks = null;
    assert(() {
      debugPrint('PERFECT_MASK_SESSION_OWNER detach (no dispose)');
      return true;
    }());
  }

  static void setOutfit(OutfitReport report) => lastOutfit = report;

  static void setOutfitIntelligence(OutfitAnalysis analysis) {
    lastOutfitIntelligence = analysis;
  }

  static void setRecolorAttemptId(String? id) => lastRecolorAttemptId = id;

  static void clear() {
    lastPerfectMasks?.dispose();
    lastPerfectMasks = null;
    lastMaskCreateProof = null;
    lastSkin = null;
    lastOutfit = null;
    lastOutfitIntelligence = null;
    lastRecolorAttemptId = null;
    userGender = UserGender.female;
  }

  /// Skin report available for Smart outfit mode / fusion.
  static bool get hasSkinReport => lastSkin != null;

  /// Full recommendations need both skin and outfit in session.
  static bool get canBuildFullRecommendation =>
      lastSkin != null && lastOutfit != null;

  @Deprecated('Use hasSkinReport — outfit analysis no longer requires skin')
  static bool get canAnalyzeOutfit => hasSkinReport;
}
