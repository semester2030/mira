import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../features/subscription/data/repositories/subscription_repository_impl.dart';
import '../navigation/app_routes.dart';
import '../services/app_session.dart';

/// Checks subscription limits before paid analysis features.
abstract final class SubscriptionGate {
  SubscriptionGate._();

  static final _repo = SubscriptionRepositoryImpl();

  static Future<bool> canAnalyzeSkin(BuildContext context) =>
      _check(context, kind: _AnalysisKind.skin);

  static Future<bool> canAnalyzeOutfit(BuildContext context) =>
      _check(context, kind: _AnalysisKind.outfit);

  static Future<bool> _check(
    BuildContext context, {
    required _AnalysisKind kind,
  }) async {
    if (AppSession.isGuest) return true;

    try {
      final status = await _repo.getStatus();
      final allowed = kind == _AnalysisKind.skin
          ? status.canAnalyzeSkin()
          : status.canAnalyzeOutfit();

      if (allowed) return true;

      if (!context.mounted) return false;
      await Navigator.pushNamed(
        context,
        AppRoutes.paywall,
        arguments: status,
      );
      return false;
    } on DioException catch (e) {
      if (e.response?.statusCode == 403) {
        if (!context.mounted) return false;
        await Navigator.pushNamed(context, AppRoutes.paywall);
        return false;
      }
      return true;
    } catch (_) {
      return true;
    }
  }
}

enum _AnalysisKind { skin, outfit }
