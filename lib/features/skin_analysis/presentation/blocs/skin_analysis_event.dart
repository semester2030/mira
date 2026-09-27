import 'package:equatable/equatable.dart';

abstract class SkinAnalysisEvent extends Equatable {
  const SkinAnalysisEvent();

  @override
  List<Object?> get props => [];
}

class StartSkinAnalysis extends SkinAnalysisEvent {
  final String imagePath;
  final int? attemptId;

  const StartSkinAnalysis({
    required this.imagePath,
    this.attemptId,
  });

  @override
  List<Object?> get props => [imagePath, attemptId];
}

class LoadAnalysisHistory extends SkinAnalysisEvent {
  const LoadAnalysisHistory();
}
