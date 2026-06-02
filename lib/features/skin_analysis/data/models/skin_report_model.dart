import '../../domain/entities/skin_report.dart';

class SkinReportModel extends SkinReport {
  SkinReportModel({
    super.id,
    required super.skinType,
    super.skinTypeEn,
    required super.score,
    required super.hydration,
    required super.oiliness,
    required super.pores,
    required super.wrinkles,
    required super.spots,
    super.acne,
    super.redness,
    super.undertone,
    super.undertoneEn,
    super.skinTone,
    super.skinToneEn,
    super.recommendations,
    required super.advice,
    super.imageUrl,
    super.createdAt,
    super.skinAge,
    super.concernScores,
  });

  factory SkinReportModel.fromEntity(SkinReport entity, {String? docId}) {
    return SkinReportModel(
      id: docId ?? entity.id,
      skinType: entity.skinType,
      skinTypeEn: entity.skinTypeEn,
      score: entity.score,
      hydration: entity.hydration,
      oiliness: entity.oiliness,
      pores: entity.pores,
      wrinkles: entity.wrinkles,
      spots: entity.spots,
      acne: entity.acne,
      redness: entity.redness,
      undertone: entity.undertone,
      undertoneEn: entity.undertoneEn,
      skinTone: entity.skinTone,
      skinToneEn: entity.skinToneEn,
      recommendations: entity.recommendations,
      advice: entity.advice,
      imageUrl: entity.imageUrl,
      createdAt: entity.createdAt,
      skinAge: entity.skinAge,
      concernScores: entity.concernScores,
    );
  }

  factory SkinReportModel.fromJson(String docId, Map<String, dynamic> json) {
    final createdAtRaw = json['createdAt'];
    DateTime? createdAt;
    if (createdAtRaw is String) {
      createdAt = DateTime.tryParse(createdAtRaw);
    }

    final recommendationsRaw = json['recommendations'];
    List<String> recommendations = const [];
    if (recommendationsRaw is List) {
      recommendations = recommendationsRaw.map((e) => e.toString()).toList();
    }

    final advice = json['advice'] as String? ?? '';
    final concernRaw = json['concernScores'];
    final concernScores = <String, int>{};
    if (concernRaw is Map) {
      concernRaw.forEach((key, value) {
        if (value is num) concernScores[key.toString()] = value.toInt();
      });
    }

    return SkinReportModel(
      id: docId,
      skinType: json['skinType'] as String? ?? '',
      skinTypeEn: json['skinTypeEn'] as String? ?? '',
      score: (json['score'] as num?)?.toDouble() ?? 0,
      hydration: (json['hydration'] as num?)?.toInt() ?? 0,
      oiliness: (json['oiliness'] as num?)?.toInt() ?? 0,
      pores: (json['pores'] as num?)?.toInt() ?? 0,
      wrinkles: (json['wrinkles'] as num?)?.toInt() ?? 0,
      spots: (json['spots'] as num?)?.toInt() ?? 0,
      acne: (json['acne'] as num?)?.toInt() ?? 0,
      redness: (json['redness'] as num?)?.toInt() ?? 0,
      undertone: json['undertone'] as String? ?? '',
      undertoneEn: json['undertoneEn'] as String? ?? '',
      skinTone: json['skinTone'] as String? ?? '',
      skinToneEn: json['skinToneEn'] as String? ?? '',
      recommendations: recommendations.isNotEmpty ? recommendations : (advice.isNotEmpty ? [advice] : []),
      advice: advice,
      skinAge: (json['skinAge'] as num?)?.toInt(),
      concernScores: concernScores,
      // Legacy imageUrl in Firestore is ignored — zero image retention.
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'skinType': skinType,
      if (skinTypeEn.isNotEmpty) 'skinTypeEn': skinTypeEn,
      'score': score,
      'hydration': hydration,
      'oiliness': oiliness,
      'pores': pores,
      'wrinkles': wrinkles,
      'spots': spots,
      'acne': acne,
      'redness': redness,
      if (undertone.isNotEmpty) 'undertone': undertone,
      if (undertoneEn.isNotEmpty) 'undertoneEn': undertoneEn,
      if (skinTone.isNotEmpty) 'skinTone': skinTone,
      if (skinToneEn.isNotEmpty) 'skinToneEn': skinToneEn,
      if (recommendations.isNotEmpty) 'recommendations': recommendations,
      'advice': advice,
      if (skinAge != null) 'skinAge': skinAge,
      if (concernScores.isNotEmpty) 'concernScores': concernScores,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }
}
