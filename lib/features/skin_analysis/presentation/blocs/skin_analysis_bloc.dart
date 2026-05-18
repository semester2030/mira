import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/mira_api_error_message.dart';
import '../../data/repositories/skin_analysis_repository_impl.dart';
import '../../domain/repositories/skin_analysis_repository.dart';
import 'skin_analysis_event.dart';
import 'skin_analysis_state.dart';

class SkinAnalysisBloc extends Bloc<SkinAnalysisEvent, SkinAnalysisState> {
  final SkinAnalysisRepository repository;

  SkinAnalysisBloc({SkinAnalysisRepository? repository})
      : repository = repository ?? SkinAnalysisRepositoryImpl(),
        super(const SkinAnalysisInitial()) {
    on<StartSkinAnalysis>(_onStart);
    on<LoadAnalysisHistory>(_onLoadHistory);
  }

  Future<void> _onStart(
    StartSkinAnalysis event,
    Emitter<SkinAnalysisState> emit,
  ) async {
    emit(const SkinAnalysisLoading());
    try {
      final report = await repository.analyzeAndSave(imagePath: event.imagePath);
      emit(SkinAnalysisSuccess(report));
    } catch (e) {
      emit(SkinAnalysisFailure(friendlyMiraError(e)));
    }
  }

  Future<void> _onLoadHistory(
    LoadAnalysisHistory event,
    Emitter<SkinAnalysisState> emit,
  ) async {
    emit(const SkinAnalysisLoading());
    try {
      final reports = await repository.getHistory();
      emit(SkinAnalysisHistoryLoaded(reports));
    } catch (e) {
      emit(SkinAnalysisFailure(friendlyMiraError(e)));
    }
  }
}
