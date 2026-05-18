import 'package:equatable/equatable.dart';

import '../../domain/entities/outfit_report.dart';

abstract class OutfitAnalysisState extends Equatable {
  const OutfitAnalysisState();

  @override
  List<Object?> get props => [];
}

class OutfitAnalysisInitial extends OutfitAnalysisState {
  const OutfitAnalysisInitial();
}

class OutfitAnalysisLoading extends OutfitAnalysisState {
  const OutfitAnalysisLoading();
}

class OutfitAnalysisSuccess extends OutfitAnalysisState {
  final OutfitReport report;

  const OutfitAnalysisSuccess(this.report);

  @override
  List<Object?> get props => [report];
}

class OutfitAnalysisFailure extends OutfitAnalysisState {
  final String message;

  const OutfitAnalysisFailure(this.message);

  @override
  List<Object?> get props => [message];
}
