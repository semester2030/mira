import 'dart:io';

import '../../../../core/ai/ai_module.dart';
import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/session/analysis_session.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/services/user_stats_service.dart';
import '../../domain/entities/outfit_report.dart';
import '../../domain/repositories/outfit_analysis_repository.dart';
import '../../domain/services/outfit_quality_gate.dart';
import '../../domain/services/outfit_report_enricher.dart';
import '../../presentation/utils/outfit_image_processor.dart';
import '../datasources/outfit_analysis_api_data_source.dart';

class OutfitAnalysisRepositoryImpl implements OutfitAnalysisRepository {
  final OutfitAnalysisApiDataSource? _apiDataSource;

  OutfitAnalysisRepositoryImpl({OutfitAnalysisApiDataSource? apiDataSource})
      : _apiDataSource = MiraApiConfig.useBackend
            ? (apiDataSource ?? OutfitAnalysisApiDataSource())
            : null;

  @override
  Future<OutfitReport> analyze({
    required String imagePath,
    required MiraOccasion occasion,
  }) async {
    final source = File(imagePath);
    final quality = await OutfitQualityGate.evaluate(source);
    if (!quality.passed) {
      throw Exception(quality.messageAr);
    }

    final prepared = await OutfitImageProcessor.prepareForAnalysis(source);
    final preparedPath = prepared.path;

    final OutfitReport report;
    try {
      if (MiraApiConfig.useBackend) {
        report = await _apiDataSource!.analyze(
          imagePath: preparedPath,
          occasion: occasion,
        );
      } else {
        final bytes = await prepared.readAsBytes();
        final result = await AiModule.instance.outfitProvider.analyze(
          imageBytes: bytes,
          occasion: occasion,
        );
        report = OutfitResultMapper.toReport(result, createdAt: DateTime.now());
      }
    } finally {
      await TempImageCleanup.deleteIfExists(preparedPath);
      if (preparedPath != imagePath) {
        await TempImageCleanup.deleteIfExists(imagePath);
      }
    }

    final enriched = OutfitReportEnricher.enrich(
      report,
      skin: AnalysisSession.lastSkin,
      linkSessionSkin: AnalysisSession.hasSkinReport,
    );

    if (FirebaseAuth.instance.currentUser != null) {
      await UserStatsService.recordOutfitAnalysis();
    }
    return enriched;
  }

  @override
  Future<List<OutfitReport>> getHistory() async {
    if (MiraApiConfig.useBackend) {
      final rows = await _apiDataSource!.fetchHistory();
      return rows
          .map(
            (r) => OutfitReportEnricher.enrich(
              r,
              skin: AnalysisSession.lastSkin,
              linkSessionSkin: AnalysisSession.hasSkinReport,
            ),
          )
          .toList();
    }
    return [];
  }
}
