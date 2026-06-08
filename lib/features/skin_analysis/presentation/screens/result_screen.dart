import 'package:flutter/material.dart';

import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../intelligence/presentation/screens/mira_beauty_report_screen.dart';

/// Legacy route alias — delegates to [MiraBeautyReportScreen].
@Deprecated('Use AppRoutes.miraBeautyReport via MiraReportNavigation')
class ResultScreen extends StatelessWidget {
  final SkinReport report;

  const ResultScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    return MiraBeautyReportScreen(report: report, showCelebration: false);
  }
}
