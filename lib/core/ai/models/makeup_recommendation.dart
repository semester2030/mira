import 'package:equatable/equatable.dart';

class MakeupRecommendation extends Equatable {
  final String lipstickAr;
  final String lipstickEn;
  final String eyeshadowAr;
  final String eyeshadowEn;
  final String blushAr;
  final String blushEn;

  const MakeupRecommendation({
    required this.lipstickAr,
    required this.lipstickEn,
    required this.eyeshadowAr,
    required this.eyeshadowEn,
    required this.blushAr,
    required this.blushEn,
  });

  @override
  List<Object?> get props => [
        lipstickAr,
        lipstickEn,
        eyeshadowAr,
        eyeshadowEn,
        blushAr,
        blushEn,
      ];
}
