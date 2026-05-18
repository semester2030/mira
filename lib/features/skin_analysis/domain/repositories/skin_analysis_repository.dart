import '../entities/skin_report.dart';

abstract class SkinAnalysisRepository {
  /// Runs AI analysis on [imagePath] and persists result for signed-in users.
  Future<SkinReport> analyzeAndSave({required String imagePath});

  Future<List<SkinReport>> getHistory();

  Stream<List<SkinReport>> watchHistory();
}
