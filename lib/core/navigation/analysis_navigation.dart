import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/outfit_analysis/presentation/screens/outfit_upload_screen.dart';
import '../../features/privacy/presentation/screens/privacy_consent_screen.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';
import '../../features/dashboard/presentation/screens/new_analysis_screen.dart';
import '../../features/recommendations/presentation/screens/recommendations_screen.dart';
import '../services/privacy_consent_storage.dart';
import 'app_navigator.dart';
import 'app_routes.dart';
import 'premium_page_route.dart';
import 'route_args.dart';
import '../../shared/theme/colors.dart';
import '../../shared/theme/typography.dart';

/// فتح شاشات التحليل — تنقّل مباشر بـ [Navigator.push] (لا يعتمد على pushNamed).
abstract final class AnalysisNavigation {
  AnalysisNavigation._();

  static void _snack(String message) {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) return;
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
        ),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  static Future<bool> _ensureConsent(BuildContext context) async {
    if (await PrivacyConsentStorage.isAccepted()) return true;
    if (!context.mounted) return false;

    final accepted = await Navigator.of(context).push<bool>(
      PremiumPageRoute(page: const PrivacyConsentScreen()),
    );

    if (accepted == true) return true;
    if (context.mounted) {
      _snack('يلزم الموافقة على الخصوصية لبدء التحليل');
    }
    return false;
  }

  static Future<void> openSkinAnalysis(BuildContext context) async {
    try {
      if (!context.mounted) return;
      if (!await _ensureConsent(context)) return;
      if (!context.mounted) return;

      await Navigator.of(context).push<void>(
        PremiumPageRoute(page: const NewAnalysisScreen()),
      );
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('openSkinAnalysis failed: $e\n$st');
      }
      _snack('تعذّر فتح تحليل البشرة');
    }
  }

  static Future<void> openOutfitAnalysis(BuildContext context) async {
    try {
      if (!context.mounted) return;
      if (!await _ensureConsent(context)) return;
      if (!context.mounted) return;

      await Navigator.of(context).push<void>(
        PremiumPageRoute(page: const OutfitUploadScreen()),
      );
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('openOutfitAnalysis failed: $e\n$st');
      }
      _snack('تعذّر فتح تحليل الإطلالة');
    }
  }

  static Future<void> openRecommendations({
    required BuildContext context,
    SkinReport? skin,
    OutfitReport? outfit,
  }) async {
    try {
      if (!context.mounted) return;
      await Navigator.of(context).push<void>(
        PremiumPageRoute(
          settings: RouteSettings(
            name: AppRoutes.recommendations,
            arguments: RecommendationRouteArgs(skin: skin, outfit: outfit),
          ),
          page: const RecommendationsScreen(),
        ),
      );
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('openRecommendations failed: $e\n$st');
      }
      _snack('تعذّر فتح التوصيات');
    }
  }

  /// بعد إغلاق القائمة — سياق الجذر (لا تستخدم سياق الدرج بعد pop).
  static void afterDrawerClose(
    Future<void> Function(BuildContext context) action,
  ) {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 320));
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null && ctx.mounted) {
        await action(ctx);
      }
    });
  }
}
