import 'package:equatable/equatable.dart';

import '../../../../core/ai/models/mira_occasion.dart';

abstract class OutfitAnalysisEvent extends Equatable {
  const OutfitAnalysisEvent();

  @override
  List<Object?> get props => [];
}

class StartOutfitAnalysis extends OutfitAnalysisEvent {
  final String imagePath;
  final MiraOccasion occasion;

  const StartOutfitAnalysis({
    required this.imagePath,
    required this.occasion,
  });

  @override
  List<Object?> get props => [imagePath, occasion];
}
