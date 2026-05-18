import '../../../../core/ai/models/mira_occasion.dart';
import '../entities/outfit_report.dart';

abstract class OutfitAnalysisRepository {
  Future<OutfitReport> analyze({
    required String imagePath,
    required MiraOccasion occasion,
  });

  Future<List<OutfitReport>> getHistory();
}
