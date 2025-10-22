import 'package:flutter/material.dart';
import '../../domain/entities/skin_report.dart';
import '../widgets/result_card.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // بيانات وهمية
    final List<SkinReport> history = [
      SkinReport(
        skinType: 'دهني', wrinkles: 3, spots: 2, hydration: 60, oiliness: 80, pores: 4, advice: 'قلل من الزيوت.'),
      SkinReport(
        skinType: 'جاف', wrinkles: 5, spots: 1, hydration: 40, oiliness: 20, pores: 2, advice: 'استخدم مرطب قوي.'),
      SkinReport(
        skinType: 'مختلط', wrinkles: 2, spots: 0, hydration: 70, oiliness: 50, pores: 3, advice: 'حافظ على توازن البشرة.'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('سجل التحليلات')),
      body: ListView.builder(
        itemCount: history.length,
        itemBuilder: (context, index) {
          return ResultCard(report: history[index]);
        },
      ),
    );
  }
}
