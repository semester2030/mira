import 'package:flutter/material.dart';

import '../navigation/app_routes.dart';
import '../navigation/route_args.dart';
import '../services/privacy_consent_storage.dart';
import '../subscription/subscription_gate.dart';
import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

/// Ensures privacy consent before camera-based analysis flows.
abstract final class PrivacyNavigation {
  PrivacyNavigation._();

  static Future<bool> _ensureConsent(BuildContext context) async {
    if (await PrivacyConsentStorage.isAccepted()) return true;
    if (!context.mounted) return false;
    final accepted = await Navigator.pushNamed<bool>(
      context,
      AppRoutes.privacyConsent,
    );
    return accepted == true;
  }

  static Future<void> openSkinAnalysis(BuildContext context) async {
    if (!await _ensureConsent(context)) return;
    if (!context.mounted) return;
    if (!await SubscriptionGate.canAnalyzeSkin(context)) return;
    if (!context.mounted) return;
    await Navigator.pushNamed(context, AppRoutes.newAnalysis);
  }

  static Future<void> openOutfitAnalysis(BuildContext context) async {
    if (!await _ensureConsent(context)) return;
    if (!context.mounted) return;
    if (!await SubscriptionGate.canAnalyzeOutfit(context)) return;
    if (!context.mounted) return;
    await Navigator.pushNamed(context, AppRoutes.outfitUpload);
  }

  static Future<void> openRecommendations(
    BuildContext context, {
    SkinReport? skin,
    OutfitReport? outfit,
  }) async {
    if (!context.mounted) return;
    await Navigator.pushNamed(
      context,
      AppRoutes.recommendations,
      arguments: RecommendationRouteArgs(skin: skin, outfit: outfit),
    );
  }
}
