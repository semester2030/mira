import '../../../../core/ai/models/mira_occasion.dart';
import '../../domain/entities/outfit_report.dart';

/// Reads both legacy outfit rows and vision intelligence snapshots.
abstract final class OutfitHistoryReader {
  static OutfitReport? read(Map<String, dynamic> row) {
    final outfit = row['outfit'];
    final source = outfit is Map ? Map<String, dynamic>.from(outfit) : row;
    final intelligence = source['intelligence'];
    final facts = intelligence is Map
        ? Map<String, dynamic>.from(intelligence)
        : source;
    final colors = _strings(facts['dominantColors'] ?? facts['dominantColorsAr']);
    final garment = _text(facts['garmentTypeAr'] ?? facts['clothingTypeAr'] ?? facts['garmentType']);
    if (colors.isEmpty && garment.isEmpty) return null;
    final occasionId = _text(row['occasionId'] ?? facts['occasionId']);
    final occasion = MiraOccasion.fromId(occasionId) ?? MiraOccasion.casual;
    final created = DateTime.tryParse(_text(row['createdAt']));
    final score = facts['compatibilityScore'];
    return OutfitReport(
      id: _text(row['id']).isEmpty ? null : _text(row['id']),
      compatibilityScore: score is num ? score.toDouble() : 0,
      dominantColors: colors,
      garmentType: garment.isEmpty ? 'قطعة من التحليل' : garment,
      styleCategory: _text(facts['styleCategoryAr'] ?? facts['styleTypeAr']),
      occasionSuitability: _text(facts['occasionSuitabilityAr'] ?? facts['styleVerdictAr']),
      alternativeColors: _strings(facts['alternativeColorsAr'] ?? facts['recommendedColorsAr']),
      occasionId: occasion.id,
      occasionLabelAr: occasion.labelAr,
      createdAt: created,
    );
  }

  static List<String> _strings(Object? value) {
    if (value is! List) return const [];
    return value.map((item) => item.toString().trim()).where((item) => item.isNotEmpty).toList();
  }

  static String _text(Object? value) => value is String ? value.trim() : '';
}
