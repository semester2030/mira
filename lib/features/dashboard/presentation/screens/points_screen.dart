import 'package:flutter/material.dart';

class PointsScreen extends StatelessWidget {
  const PointsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final points = 120;
    final sources = [
      {'label': 'تحليلات البشرة', 'value': 80},
      {'label': 'تطبيق النصائح', 'value': 40},
    ];
    final rewards = [
      'خصم 10% على منتجات العناية بالبشرة',
      'استشارة مجانية مع أخصائية تجميل',
      'دخول سحب شهري على هدايا حصرية',
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('نقاط التميز')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('نقاطك الحالية:', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('$points', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.purple)),
            const SizedBox(height: 24),
            Text('مصادر النقاط:', style: Theme.of(context).textTheme.titleMedium),
            ...sources.map((s) => ListTile(
              leading: const Icon(Icons.check_circle, color: Colors.green),
              title: Text('${s['label']}'),
              trailing: Text('${s['value']}'),
            )),
            const SizedBox(height: 24),
            Text('مكافآت مقترحة:', style: Theme.of(context).textTheme.titleMedium),
            ...rewards.map((r) => ListTile(
              leading: const Icon(Icons.card_giftcard, color: Colors.orange),
              title: Text(r),
            )),
          ],
        ),
      ),
    );
  }
} 