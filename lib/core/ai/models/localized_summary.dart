import 'package:equatable/equatable.dart';

class LocalizedSummary extends Equatable {
  final String ar;
  final String en;

  const LocalizedSummary({required this.ar, required this.en});

  @override
  List<Object?> get props => [ar, en];
}
