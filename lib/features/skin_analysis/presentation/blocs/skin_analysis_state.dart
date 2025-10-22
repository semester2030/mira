import '../../domain/entities/skin_report.dart';

abstract class SkinAnalysisState {}

class SkinAnalysisInitial extends SkinAnalysisState {}

class SkinAnalysisLoading extends SkinAnalysisState {}

class SkinAnalysisSuccess extends SkinAnalysisState {
  final SkinReport report;
  SkinAnalysisSuccess(this.report);
}

class SkinAnalysisFailure extends SkinAnalysisState {
  final String message;
  SkinAnalysisFailure(this.message);
}
