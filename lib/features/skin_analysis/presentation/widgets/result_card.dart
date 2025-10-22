import 'package:flutter/material.dart';
import '../../domain/entities/skin_report.dart';

class ResultCard extends StatelessWidget {
  final SkinReport report;
  const ResultCard({Key? key, required this.report}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('نوع البشرة: ${report.skinType}', style: Theme.of(context).textTheme.titleMedium),
            Text('الترطيب: ${report.hydration}% | الدهون: ${report.oiliness}%'),
            Text('التجاعيد: ${report.wrinkles} | البقع: ${report.spots} | المسام: ${report.pores}'),
            const SizedBox(height: 8),
            Text('نصيحة: ${report.advice}', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
