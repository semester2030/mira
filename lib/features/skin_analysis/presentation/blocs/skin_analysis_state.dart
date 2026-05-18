import 'package:equatable/equatable.dart';
import '../../domain/entities/skin_report.dart';

abstract class SkinAnalysisState extends Equatable {
  const SkinAnalysisState();

  @override
  List<Object?> get props => [];
}

class SkinAnalysisInitial extends SkinAnalysisState {
  const SkinAnalysisInitial();
}

class SkinAnalysisLoading extends SkinAnalysisState {
  const SkinAnalysisLoading();
}

class SkinAnalysisSuccess extends SkinAnalysisState {
  final SkinReport report;

  const SkinAnalysisSuccess(this.report);

  @override
  List<Object?> get props => [report];
}

class SkinAnalysisFailure extends SkinAnalysisState {
  final String message;

  const SkinAnalysisFailure(this.message);

  @override
  List<Object?> get props => [message];
}

class SkinAnalysisHistoryLoaded extends SkinAnalysisState {
  final List<SkinReport> reports;

  const SkinAnalysisHistoryLoaded(this.reports);

  @override
  List<Object?> get props => [reports];
}
