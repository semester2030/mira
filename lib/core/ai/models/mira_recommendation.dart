import 'package:equatable/equatable.dart';

import 'localized_summary.dart';
import 'makeup_recommendation.dart';
import 'mira_occasion.dart';
import 'outfit_analysis_result.dart';
import 'skin_analysis_result.dart';
import 'styling_recommendation.dart';

/// Unified Mira recommendation — single contract for UI and API responses.
class MiraRecommendation extends Equatable {
  final SkinAnalysisResult skin;
  final OutfitAnalysisResult? outfit;
  final MakeupRecommendation makeup;
  final StylingRecommendation styling;
  final LocalizedSummary summary;
  final MiraOccasion? occasion;

  const MiraRecommendation({
    required this.skin,
    this.outfit,
    required this.makeup,
    required this.styling,
    required this.summary,
    this.occasion,
  });

  @override
  List<Object?> get props => [skin, outfit, makeup, styling, summary, occasion];
}
