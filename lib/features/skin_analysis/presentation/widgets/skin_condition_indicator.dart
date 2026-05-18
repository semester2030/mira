import 'package:flutter/material.dart';

class SkinConditionIndicator extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const SkinConditionIndicator({super.key, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                value: value / 100,
                color: color,
                backgroundColor: color.withValues(alpha: 0.2),
                strokeWidth: 6,
              ),
            ),
            Text('$value%', style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
