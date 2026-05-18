import 'package:flutter/material.dart';

class MirraProgressIndicator extends StatelessWidget {
  final double value;
  final Color color;
  const MirraProgressIndicator({super.key, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: LinearProgressIndicator(
        value: value,
        color: color,
        backgroundColor: color.withValues(alpha: 0.2),
        minHeight: 10,
      ),
    );
  }
}
