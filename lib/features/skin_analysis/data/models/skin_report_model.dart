import '../../domain/entities/skin_report.dart';

class SkinReportModel extends SkinReport {
  SkinReportModel({
    required super.skinType,
    required super.wrinkles,
    required super.spots,
    required super.hydration,
    required super.oiliness,
    required super.pores,
    required super.advice,
  });

  factory SkinReportModel.fromJson(Map<String, dynamic> json) {
    return SkinReportModel(
      skinType: json['skinType'] ?? '',
      wrinkles: json['wrinkles'] ?? 0,
      spots: json['spots'] ?? 0,
      hydration: json['hydration'] ?? 0,
      oiliness: json['oiliness'] ?? 0,
      pores: json['pores'] ?? 0,
      advice: json['advice'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'skinType': skinType,
      'wrinkles': wrinkles,
      'spots': spots,
      'hydration': hydration,
      'oiliness': oiliness,
      'pores': pores,
      'advice': advice,
    };
  }
}
