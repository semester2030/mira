import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/widgets/ask_mira_entry.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_analysis_mapper.dart';
import '../../domain/helpers/outfit_result_trust.dart';
import 'outfit_studio_screen.dart';
import '../widgets/outfit_untrusted_result_view.dart';

class OutfitResultScreen extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitResultScreen({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setOutfitIntelligence(analysis);
    AnalysisSession.setOutfit(OutfitAnalysisMapper.toLegacyReport(analysis));

    final trust = OutfitResultTrustPolicy.evaluate(analysis);

    if (trust.isBlocked) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'نتيجة الإطلالة'),
        body: FloatingGradientBackground(
          showOrbs: false,
          showParticles: false,
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(0, 0, 0, 24),
              children: [
                OutfitUntrustedResultView(trust: trust, analysis: analysis),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _askMira(analysis),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(pageTitle: 'إطلالتك'),
      body: OutfitStudioScreen(analysis: analysis),
    );
  }
}

AskMiraEntry _askMira(OutfitAnalysis analysis) {
  final colors = analysis.dominantColors.take(3).join('، ');
  return AskMiraEntry(
    contextLine: colors.isEmpty
        ? 'نناقش نتيجة الإطلالة من الأدلة الظاهرة فقط.'
        : 'الألوان الظاهرة في النتيجة: $colors',
    suggestions: [
      if (analysis.dominantColors.isNotEmpty) 'كيف أنسق لون ${analysis.dominantColors.first}؟',
      'هل الإطلالة تناسب المناسبة؟',
      'ما الإكسسوار المناسب؟',
    ],
    routeArgs: (question) => AdvisorRouteArgs(
      outfitAnalysis: analysis,
      initialQuestion: question,
    ),
  );
}
