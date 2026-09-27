import 'package:equatable/equatable.dart';
import '../../../face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart';
import '../../domain/entities/skin_report.dart';

abstract class SkinAnalysisState extends Equatable {
  const SkinAnalysisState();

  @override
  List<Object?> get props => [];
}

class SkinAnalysisInitial extends SkinAnalysisState {
  const SkinAnalysisInitial();
}

/// Local prep / upload not yet dispatched — Soft Laser must NOT run.
class SkinAnalysisSubmitting extends SkinAnalysisState {
  final int? attemptId;

  const SkinAnalysisSubmitting({this.attemptId});

  @override
  List<Object?> get props => [attemptId];
}

/// Remote Face pipeline wait — Soft Laser may run (presentation group).
class SkinAnalysisProcessing extends SkinAnalysisState {
  final int? attemptId;

  const SkinAnalysisProcessing({this.attemptId});

  @override
  List<Object?> get props => [attemptId];
}

class SkinAnalysisLoading extends SkinAnalysisState {
  const SkinAnalysisLoading();
}

class SkinAnalysisSuccess extends SkinAnalysisState {
  final SkinReport report;
  final int? attemptId;

  const SkinAnalysisSuccess(this.report, {this.attemptId});

  @override
  List<Object?> get props => [report, attemptId];
}

class SkinAnalysisFailure extends SkinAnalysisState {
  final String message;
  final FaceAnalysisJourneyError? journeyError;
  final int? attemptId;

  const SkinAnalysisFailure(
    this.message, {
    this.journeyError,
    this.attemptId,
  });

  bool get requiresRecapture => journeyError?.requiresRecapture ?? false;

  @override
  List<Object?> get props => [message, journeyError?.code, attemptId];
}

class SkinAnalysisHistoryLoaded extends SkinAnalysisState {
  final List<SkinReport> reports;

  const SkinAnalysisHistoryLoaded(this.reports);

  @override
  List<Object?> get props => [reports];
}
