import 'dart:io';

import '../../../../core/ai/ai_module.dart';
import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/services/user_stats_service.dart';
import '../../domain/entities/outfit_report.dart';
import '../../domain/repositories/outfit_analysis_repository.dart';
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
    final OutfitReport report;
    if (MiraApiConfig.useBackend) {
      report = await _apiDataSource!.analyze(imagePath: imagePath, occasion: occasion);
    } else {
      final file = File(imagePath);
      if (!await file.exists()) {
        throw Exception('لم يتم العثور على صورة الإطلالة');
      }

      try {
        final bytes = await file.readAsBytes();
        final result = await AiModule.instance.outfitProvider.analyze(
          imageBytes: bytes,
          occasion: occasion,
        );
        report = OutfitResultMapper.toReport(result, createdAt: DateTime.now());
      } finally {
        await TempImageCleanup.deleteIfExists(imagePath);
      }
    }

    if (FirebaseAuth.instance.currentUser != null) {
      await UserStatsService.recordOutfitAnalysis();
    }
    return report;
  }

  @override
  Future<List<OutfitReport>> getHistory() async {
    if (MiraApiConfig.useBackend) {
      return _apiDataSource!.fetchHistory();
    }
    return [];
  }
}
