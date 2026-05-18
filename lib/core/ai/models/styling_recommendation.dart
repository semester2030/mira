import 'package:equatable/equatable.dart';

class StylingRecommendation extends Equatable {
  final List<String> accessoriesAr;
  final List<String> accessoriesEn;

  const StylingRecommendation({
    required this.accessoriesAr,
    required this.accessoriesEn,
  });

  @override
  List<Object?> get props => [accessoriesAr, accessoriesEn];
}
