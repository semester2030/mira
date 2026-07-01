import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/delight/analysis_celebration.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
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
            child: OutfitUntrustedResultView(trust: trust, analysis: analysis),
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
