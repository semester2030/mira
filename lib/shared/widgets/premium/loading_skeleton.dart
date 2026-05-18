import 'package:flutter/material.dart';
import '../shimmer_placeholder.dart';

class LoadingSkeleton extends StatelessWidget {
  final int lines;

  const LoadingSkeleton({super.key, this.lines = 3});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(lines, (i) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ShimmerPlaceholder(
            height: i == 0 ? 24 : 16,
            width: i == 0 ? double.infinity : 200 + (i * 40.0),
          ),
        );
      }),
    );
  }
}
