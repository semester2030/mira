import 'package:flutter/material.dart';
import '../../domain/entities/skin_report.dart';
import '../../../../shared/widgets/mirra_card.dart';

class ResultScreen extends StatelessWidget {
  const ResultScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final SkinReport report = ModalRoute.of(context)!.settings.arguments as SkinReport;
    return Scaffold(
      appBar: AppBar(title: const Text('نتيجة التحليل')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MirraCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('نوع البشرة: ${report.skinType}', style: Theme.of(context).textTheme.titleMedium),
                  Text('التجاعيد: ${report.wrinkles}'),
                  Text('البقع: ${report.spots}'),
                  Text('الترطيب: ${report.hydration}%'),
                  Text('الدهون: ${report.oiliness}%'),
                  Text('المسام: ${report.pores}'),
                  const SizedBox(height: 16),
                  Text('نصيحة اليوم:', style: Theme.of(context).textTheme.titleSmall),
                  Text(report.advice, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
