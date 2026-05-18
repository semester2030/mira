import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

/// In-memory session for chaining skin → outfit → unified recommendations.
abstract final class AnalysisSession {
  static SkinReport? lastSkin;
  static OutfitReport? lastOutfit;

  static void setSkin(SkinReport report) => lastSkin = report;

  static void setOutfit(OutfitReport report) => lastOutfit = report;

  static void clear() {
    lastSkin = null;
    lastOutfit = null;
  }

  static bool get canBuildFullRecommendation => lastSkin != null;
}
