import '../../features/outfit_analysis/domain/entities/outfit_analysis.dart';
import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/outfit_analysis/domain/entities/user_gender.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

/// In-memory session for chaining skin → outfit → unified recommendations.
abstract final class AnalysisSession {
  static SkinReport? lastSkin;
  static OutfitReport? lastOutfit;
  static OutfitAnalysis? lastOutfitIntelligence;
  static String? lastRecolorAttemptId;
  static UserGender userGender = UserGender.female;

  static void setSkin(SkinReport report) => lastSkin = report;

  static void setOutfit(OutfitReport report) => lastOutfit = report;

  static void setOutfitIntelligence(OutfitAnalysis analysis) {
    lastOutfitIntelligence = analysis;
  }

  static void setRecolorAttemptId(String? id) => lastRecolorAttemptId = id;

  static void clear() {
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
