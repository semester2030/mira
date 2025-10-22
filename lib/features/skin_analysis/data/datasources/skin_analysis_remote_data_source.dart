import '../models/skin_report_model.dart';

class SkinAnalysisRemoteDataSource {
  Future<SkinReportModel> analyzeSkin(/* params */) async {
    await Future.delayed(const Duration(seconds: 2));
    return SkinReportModel(
      skinType: 'Normal',
      wrinkles: 2,
      spots: 1,
      hydration: 80,
      oiliness: 40,
      pores: 3,
      advice: 'حافظ على ترطيب بشرتك واشرب الماء بانتظام.'
    );
  }
}
