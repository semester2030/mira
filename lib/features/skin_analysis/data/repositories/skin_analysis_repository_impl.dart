import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/ai/ai_module.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../../../core/ai/mappers/skin_result_mapper.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../domain/entities/skin_report.dart';
import '../../domain/repositories/skin_analysis_repository.dart';
import '../datasources/skin_analysis_api_data_source.dart';
import '../datasources/skin_analysis_remote_data_source.dart';

class SkinAnalysisRepositoryImpl implements SkinAnalysisRepository {
  final SkinAnalysisRemoteDataSource? firestoreDataSource;
  final SkinAnalysisApiDataSource? apiDataSource;

  SkinAnalysisRepositoryImpl({
    SkinAnalysisRemoteDataSource? firestoreDataSource,
    SkinAnalysisApiDataSource? apiDataSource,
  })  : firestoreDataSource = MiraApiConfig.useBackend
            ? null
            : (firestoreDataSource ?? SkinAnalysisRemoteDataSource()),
        apiDataSource = MiraApiConfig.useBackend
            ? (apiDataSource ?? SkinAnalysisApiDataSource())
            : null;

  @override
  Future<SkinReport> analyzeAndSave({required String imagePath}) {
    if (MiraApiConfig.useBackend) {
      return apiDataSource!.analyzeAndSave(imagePath: imagePath);
    }
    return firestoreDataSource!.analyzeAndSave(imagePath: imagePath);
  }

  @override
  Future<List<SkinReport>> getHistory() {
    if (MiraApiConfig.useBackend) {
      return apiDataSource!.fetchHistory();
    }
    return firestoreDataSource!.fetchHistory();
  }

  @override
  Stream<List<SkinReport>> watchHistory() {
    if (MiraApiConfig.useBackend) {
      return Stream.fromFuture(apiDataSource!.fetchHistory());
    }
    return firestoreDataSource!.watchHistory();
  }
}

/// Guest analysis — local mock only unless signed in with [MiraApiConfig.useBackend].
class GuestSkinAnalysisRepository {
  Future<SkinReport> analyzeFromImage(String imagePath) async {
    if (MiraApiConfig.useBackend && FirebaseAuth.instance.currentUser != null) {
      final model =
          await SkinAnalysisApiDataSource().analyzeAndSave(imagePath: imagePath);
      return model;
    }

    final file = File(imagePath);
    if (!await file.exists()) {
      throw Exception('لم يتم العثور على صورة التحليل');
    }
    try {
      final bytes = await file.readAsBytes();
      final result = await AiModule.instance.skinProvider.analyze(bytes);
      return SkinResultMapper.toReport(result, createdAt: DateTime.now());
    } finally {
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }
}
