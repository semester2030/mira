import 'package:flutter/material.dart';

import '../navigation/analysis_navigation.dart';
import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

/// @deprecated استخدم [AnalysisNavigation] — يُبقى للتوافق مع الاستدعاءات القديمة.
abstract final class PrivacyNavigation {
  PrivacyNavigation._();

  static Future<void> openSkinAnalysis(BuildContext context) =>
      AnalysisNavigation.openSkinAnalysis(context);

  static Future<void> openOutfitAnalysis(BuildContext context) =>
      AnalysisNavigation.openOutfitAnalysis(context);

  static Future<void> openRecommendations(
    BuildContext context, {
    SkinReport? skin,
    OutfitReport? outfit,
  }) =>
      AnalysisNavigation.openRecommendations(
        context: context,
        skin: skin,
        outfit: outfit,
      );
}
