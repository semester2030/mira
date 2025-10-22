import '../../domain/entities/skin_report.dart';
import '../datasources/skin_analysis_remote_data_source.dart';

abstract class SkinAnalysisRepository {
  Future<SkinReport> analyzeSkin();
}

class SkinAnalysisRepositoryImpl implements SkinAnalysisRepository {
  final SkinAnalysisRemoteDataSource remoteDataSource;
  SkinAnalysisRepositoryImpl(this.remoteDataSource);

  @override
  Future<SkinReport> analyzeSkin() {
    return remoteDataSource.analyzeSkin();
  }
}
