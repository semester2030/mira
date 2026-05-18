import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/mira_api_error_message.dart';
import '../../data/repositories/outfit_analysis_repository_impl.dart';
import '../../domain/repositories/outfit_analysis_repository.dart';
import 'outfit_analysis_event.dart';
import 'outfit_analysis_state.dart';

class OutfitAnalysisBloc extends Bloc<OutfitAnalysisEvent, OutfitAnalysisState> {
  final OutfitAnalysisRepository repository;

  OutfitAnalysisBloc({OutfitAnalysisRepository? repository})
      : repository = repository ?? OutfitAnalysisRepositoryImpl(),
        super(const OutfitAnalysisInitial()) {
    on<StartOutfitAnalysis>(_onStart);
  }

  Future<void> _onStart(
    StartOutfitAnalysis event,
    Emitter<OutfitAnalysisState> emit,
  ) async {
    emit(const OutfitAnalysisLoading());
    try {
      final report = await repository.analyze(
        imagePath: event.imagePath,
        occasion: event.occasion,
      );
      emit(OutfitAnalysisSuccess(report));
    } catch (e) {
      emit(OutfitAnalysisFailure(friendlyMiraError(e)));
    }
  }
}
