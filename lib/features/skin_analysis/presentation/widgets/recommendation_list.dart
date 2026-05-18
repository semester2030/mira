import 'package:flutter/material.dart';

class RecommendationList extends StatelessWidget {
  final List<String> recommendations;
  const RecommendationList({super.key, required this.recommendations});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...recommendations.map((rec) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4.0),
          child: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.green, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text(rec, style: Theme.of(context).textTheme.bodyMedium)),
            ],
          ),
        ))
      ],
    );
  }
}
