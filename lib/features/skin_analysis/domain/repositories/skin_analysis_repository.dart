import '../../domain/entities/skin_report.dart';

abstract class SkinAnalysisRepository {
  /// [onRemoteWaitStarted] fires after local gates when the HTTP Face request
  /// is dispatched (truthful Soft Laser threshold for sync API).
  Future<SkinReport> analyzeAndSave({
    required String imagePath,
    void Function()? onRemoteWaitStarted,
  });

  Future<List<SkinReport>> getHistory();

  Stream<List<SkinReport>> watchHistory();
}
