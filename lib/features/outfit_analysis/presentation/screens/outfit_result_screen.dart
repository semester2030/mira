import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/delight/analysis_celebration.dart';
import '../../../../shared/widgets/ask_mira_entry.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_analysis_mapper.dart';
import '../../domain/helpers/outfit_result_sections.dart';
import '../../domain/helpers/outfit_result_trust.dart';
import '../widgets/engagement/outfit_result_story_shell.dart';
import '../widgets/outfit_result_motion.dart';
import '../widgets/outfit_untrusted_result_view.dart';
import '../widgets/outfit_trust_degraded_banner.dart';

class OutfitResultScreen extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitResultScreen({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setOutfitIntelligence(analysis);
    AnalysisSession.setOutfit(OutfitAnalysisMapper.toLegacyReport(analysis));

    final sections = OutfitResultSections.plan(analysis);
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
      appBar: const MiraAppBar(pageTitle: 'نتيجة الإطلالة'),
      body: CelebrationOnMount(
        message: AnalysisCelebration.messageForOutfit(),
        child: OutfitResultAmbience(
          child: FloatingGradientBackground(
            showOrbs: false,
            showParticles: false,
            child: SafeArea(
              child: Column(
                children: [
                  if (trust.isDegraded) OutfitTrustDegradedBanner(trust: trust),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                    child: _askMira(analysis),
                  ),
                  Expanded(
                    child: OutfitResultStoryShell(
                      analysis: analysis,
                      sections: sections,
                      trust: trust,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
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
