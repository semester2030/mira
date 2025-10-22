import 'package:flutter/material.dart';

class TipsScreen extends StatelessWidget {
  const TipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tips = [
      {'icon': Icons.water_drop, 'text': 'اشربي 8 أكواب ماء يومياً للحفاظ على نضارة بشرتك.'},
      {'icon': Icons.spa, 'text': 'استخدمي مرطب مناسب بعد غسل وجهك.'},
      {'icon': Icons.wb_sunny, 'text': 'لا تنسي واقي الشمس عند الخروج نهاراً.'},
      {'icon': Icons.nightlight, 'text': 'احرصي على النوم الكافي (7-8 ساعات) يومياً.'},
      {'icon': Icons.clean_hands, 'text': 'تجنبي لمس وجهك كثيراً للحفاظ على نظافة البشرة.'},
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('نصائح العناية')),
      body: ListView.separated(
        padding: const EdgeInsets.all(24),
        itemCount: tips.length,
        separatorBuilder: (_, __) => const Divider(),
        itemBuilder: (context, i) => ListTile(
          leading: Icon(tips[i]['icon'] as IconData, color: Colors.pink),
          title: Text(tips[i]['text'] as String),
        ),
      ),
    );
  }
} 