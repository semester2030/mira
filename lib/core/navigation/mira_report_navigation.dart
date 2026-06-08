import 'package:flutter/material.dart';

import '../../features/skin_analysis/domain/entities/skin_report.dart';
import 'app_routes.dart';
import 'route_args.dart';

/// Opens the Phase 2 premium Mira Beauty Report screen.
abstract final class MiraReportNavigation {
  MiraReportNavigation._();

  static void open(
    BuildContext context,
    SkinReport report, {
    bool celebrate = false,
  }) {
    Navigator.pushNamed(
      context,
      AppRoutes.miraBeautyReport,
      arguments: MiraReportRouteArgs(report: report, celebrate: celebrate),
    );
  }

  static void openAfterAnalysis(BuildContext context, SkinReport report) {
    open(context, report, celebrate: true);
  }

  static void openFromHistory(BuildContext context, SkinReport report) {
    open(context, report, celebrate: false);
  }
}
