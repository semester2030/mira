import 'package:equatable/equatable.dart';

abstract class SkinAnalysisEvent extends Equatable {
  const SkinAnalysisEvent();

  @override
  List<Object?> get props => [];
}

class StartSkinAnalysis extends SkinAnalysisEvent {
  final String imagePath;

  const StartSkinAnalysis({required this.imagePath});

  @override
  List<Object?> get props => [imagePath];
}

class LoadAnalysisHistory extends SkinAnalysisEvent {
  const LoadAnalysisHistory();
}
