import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/mira_api_error_message.dart';
import '../../../face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart';
import '../../data/repositories/skin_analysis_repository_impl.dart';
import '../../domain/repositories/skin_analysis_repository.dart';
import 'skin_analysis_event.dart';
import 'skin_analysis_state.dart';

class SkinAnalysisBloc extends Bloc<SkinAnalysisEvent, SkinAnalysisState> {
  final SkinAnalysisRepository repository;
  bool _inFlight = false;

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
    if (_inFlight) return;
    _inFlight = true;
    emit(const SkinAnalysisSubmitting());
    try {
      final report = await repository.analyzeAndSave(
        imagePath: event.imagePath,
        onRemoteWaitStarted: () {
          if (!emit.isDone) {
            emit(const SkinAnalysisProcessing());
          }
        },
      );
      emit(SkinAnalysisSuccess(report));
    } catch (e) {
      final mapped = _mapError(e);
      emit(SkinAnalysisFailure(mapped.snackMessage, journeyError: mapped));
    } finally {
      _inFlight = false;
    }
  }

  FaceAnalysisJourneyError _mapError(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      String? code;
      String? category;
      String? message;
      bool? requiresRecapture;
      String? userAction;
      if (data is Map) {
        code = data['code']?.toString() ?? data['captureCode']?.toString();
        category = data['category']?.toString();
        final m = data['message'];
        if (m is String) message = m;
        if (data['requiresRecapture'] is bool) {
          requiresRecapture = data['requiresRecapture'] as bool;
        }
        userAction = data['userAction']?.toString();
      }
      return mapFaceAnalysisError(
        statusCode: error.response?.statusCode,
        code: code,
        category: category,
        message: message ?? friendlyMiraError(error),
        requiresRecapture: requiresRecapture,
        userAction: userAction,
      );
    }
    final friendly = friendlyMiraError(error);
    return mapFaceAnalysisError(message: friendly);
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
      final mapped = _mapError(e);
      emit(SkinAnalysisFailure(mapped.snackMessage, journeyError: mapped));
    }
  }
}
