import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/skin_report.dart';
import '../../data/repositories/skin_analysis_repository_impl.dart';
import 'skin_analysis_event.dart';
import 'skin_analysis_state.dart';

class SkinAnalysisBloc extends Bloc<SkinAnalysisEvent, SkinAnalysisState> {
  final SkinAnalysisRepository repository;

  SkinAnalysisBloc(this.repository) : super(SkinAnalysisInitial()) {
    on<StartSkinAnalysis>((event, emit) async {
      emit(SkinAnalysisLoading());
      try {
        final report = await repository.analyzeSkin();
        emit(SkinAnalysisSuccess(report));
      } catch (e) {
        emit(SkinAnalysisFailure('حدث خطأ أثناء التحليل'));
      }
    });
  }
}
