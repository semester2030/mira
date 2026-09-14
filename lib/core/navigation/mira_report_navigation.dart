import 'package:flutter/material.dart';

import '../../features/skin_analysis/domain/entities/skin_report.dart';
import 'app_routes.dart';
import 'route_args.dart';

/// Opens the Phase 2 premium Mira Beauty Report screen.
abstract final class MiraReportNavigation {
  MiraReportNavigation._();

  static Future<Object?> open(
    BuildContext context,
    SkinReport report, {
    bool celebrate = false,
    bool forceLegacy = false,
    String? captureImagePath,
    bool fromFreshAnalysis = false,
    bool fromHistory = false,
  }) {
    return Navigator.pushNamed(
      context,
      AppRoutes.miraBeautyReport,
      arguments: MiraReportRouteArgs(
        report: report,
        celebrate: celebrate,
        forceLegacy: forceLegacy,
        captureImagePath: captureImagePath,
        fromFreshAnalysis: fromFreshAnalysis,
        fromHistory: fromHistory,
      ),
    );
  }

  static Future<Object?> openAfterAnalysis(
    BuildContext context,
    SkinReport report, {
    String? captureImagePath,
  }) {
    return open(
      context,
      report,
      celebrate: true,
      captureImagePath: captureImagePath,
      fromFreshAnalysis: true,
    );
  }

  /// Opens historical Face Result Mirror when flag ON (that report's projection only).
  static Future<Object?> openFromHistory(BuildContext context, SkinReport report) {
    return open(
      context,
      report,
      celebrate: false,
      fromFreshAnalysis: false,
      fromHistory: true,
    );
  }
}
