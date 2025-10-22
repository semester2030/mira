import 'package:flutter/material.dart';

class MirraProgressIndicator extends StatelessWidget {
  final double value;
  final Color color;
  const MirraProgressIndicator({Key? key, required this.value, required this.color}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: LinearProgressIndicator(
        value: value,
        color: color,
        backgroundColor: color.withOpacity(0.2),
        minHeight: 10,
      ),
    );
  }
}
