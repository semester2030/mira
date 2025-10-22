import 'package:flutter/material.dart';

class AnalysisScreen extends StatelessWidget {
  const AnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final analyses = [
      {'date': '12/05/2025', 'type': 'مختلطة', 'result': 'جيدة جداً'},
      {'date': '01/05/2025', 'type': 'جافة', 'result': 'بحاجة لترطيب'},
      {'date': '20/04/2025', 'type': 'دهنية', 'result': 'ممتازة'},
      {'date': '10/04/2025', 'type': 'عادية', 'result': 'بحاجة لعناية إضافية'},
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل التحليلات')),
      body: ListView.separated(
        padding: const EdgeInsets.all(24),
        itemCount: analyses.length,
        separatorBuilder: (_, __) => const Divider(),
        itemBuilder: (context, i) => ListTile(
          leading: const Icon(Icons.analytics, color: Colors.purple),
          title: Text('تحليل ${i + 1} - ${analyses[i]['date']}'),
          subtitle: Text('نوع البشرة: ${analyses[i]['type']} - النتيجة: ${analyses[i]['result']}'),
        ),
      ),
    );
  }
} 