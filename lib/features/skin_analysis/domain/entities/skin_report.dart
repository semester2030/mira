class SkinReport {
  final String? id;
  final String skinType;
  final String skinTypeEn;
  final double score;
  final int hydration;
  final int oiliness;
  final int pores;
  final int wrinkles;
  final int spots;
  final int acne;
  final int redness;
  final String undertone;
  final String undertoneEn;
  final String skinTone;
  final String skinToneEn;
  final List<String> recommendations;
  final String advice;
  final String? imageUrl;
  final DateTime? createdAt;

  const SkinReport({
    this.id,
    required this.skinType,
    this.skinTypeEn = '',
    required this.score,
    required this.hydration,
    required this.oiliness,
    required this.pores,
    required this.wrinkles,
    required this.spots,
    this.acne = 0,
    this.redness = 0,
    this.undertone = '',
    this.undertoneEn = '',
    this.skinTone = '',
    this.skinToneEn = '',
    this.recommendations = const [],
    required this.advice,
    this.imageUrl,
    this.createdAt,
  });

  double get beautyScore => score;

  SkinReport copyWith({
    String? id,
    String? skinType,
    String? skinTypeEn,
    double? score,
    int? hydration,
    int? oiliness,
    int? pores,
    int? wrinkles,
    int? spots,
    int? acne,
    int? redness,
    String? undertone,
    String? undertoneEn,
    String? skinTone,
    String? skinToneEn,
    List<String>? recommendations,
    String? advice,
    String? imageUrl,
    DateTime? createdAt,
  }) {
    return SkinReport(
      id: id ?? this.id,
      skinType: skinType ?? this.skinType,
      skinTypeEn: skinTypeEn ?? this.skinTypeEn,
      score: score ?? this.score,
      hydration: hydration ?? this.hydration,
      oiliness: oiliness ?? this.oiliness,
      pores: pores ?? this.pores,
      wrinkles: wrinkles ?? this.wrinkles,
      spots: spots ?? this.spots,
      acne: acne ?? this.acne,
      redness: redness ?? this.redness,
      undertone: undertone ?? this.undertone,
      undertoneEn: undertoneEn ?? this.undertoneEn,
      skinTone: skinTone ?? this.skinTone,
      skinToneEn: skinToneEn ?? this.skinToneEn,
      recommendations: recommendations ?? this.recommendations,
      advice: advice ?? this.advice,
      imageUrl: imageUrl ?? this.imageUrl,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
