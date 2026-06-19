import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import 'outfit_intelligence_providers.dart';

class OutfitIntelligenceNotifier extends StateNotifier<AsyncValue<OutfitAnalysis?>> {
  OutfitIntelligenceNotifier(this._ref) : super(const AsyncData(null));

  final Ref _ref;

  Future<void> analyze({
    required String imagePath,
    required MiraOccasion occasion,
    required OutfitAnalysisMode mode,
  }) async {
    if (mode == OutfitAnalysisMode.smart) {
      final skin = _ref.read(optionalSkinReportProvider);
      if (skin == null) {
        state = AsyncError(
          StateError('يجب إجراء تحليل البشرة للتحليل الذكي'),
          StackTrace.current,
        );
        return;
      }
    }

    state = const AsyncLoading();
    try {
      final service = _ref.read(outfitIntelligenceServiceProvider);
      final result = await service.analyze(
        skin: _ref.read(optionalSkinReportProvider),
        outfitImage: File(imagePath),
        occasion: occasion,
        mode: mode,
      );
      state = AsyncData(result);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
    }
  }

  void reset() => state = const AsyncData(null);
}
