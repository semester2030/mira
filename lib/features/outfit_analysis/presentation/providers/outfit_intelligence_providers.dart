import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/outfit_analysis_mode_storage.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../../domain/services/outfit_intelligence_service.dart';
import 'google_vision_provider.dart';
import 'outfit_intelligence_notifier.dart';

final outfitIntelligenceServiceProvider = Provider<OutfitIntelligenceService>(
  (ref) => OutfitIntelligenceService(
    visionService: ref.watch(googleVisionOutfitServiceProvider),
  ),
);

final optionalSkinReportProvider = Provider<SkinReport?>((ref) {
  return AnalysisSession.lastSkin;
});

@Deprecated('Use optionalSkinReportProvider')
final requiredSkinReportProvider = optionalSkinReportProvider;

final outfitAnalysisModeProvider =
    StateNotifierProvider<OutfitAnalysisModeNotifier, OutfitAnalysisMode>(
  (ref) => OutfitAnalysisModeNotifier(),
);

class OutfitAnalysisModeNotifier extends StateNotifier<OutfitAnalysisMode> {
  OutfitAnalysisModeNotifier() : super(OutfitAnalysisMode.quick) {
    _load();
  }

  Future<void> _load() async {
    state = await OutfitAnalysisModeStorage.load();
  }

  Future<void> select(OutfitAnalysisMode mode) async {
    state = mode;
    await OutfitAnalysisModeStorage.save(mode);
  }
}

final outfitIntelligenceNotifierProvider =
    StateNotifierProvider<OutfitIntelligenceNotifier, AsyncValue<OutfitAnalysis?>>(
  (ref) => OutfitIntelligenceNotifier(ref),
);
