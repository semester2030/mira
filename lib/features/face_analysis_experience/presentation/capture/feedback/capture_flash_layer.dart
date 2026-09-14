import 'package:flutter/material.dart';

import '../tokens/capture_mirror_tokens.dart';

/// Decorative capture flash — CAPTURE_FEEDBACK / DECORATIVE (Law #40).
/// Not an analysis scan.
class CaptureFlashLayer extends StatelessWidget {
  final double opacity;

  const CaptureFlashLayer({super.key, required this.opacity});

  @override
  Widget build(BuildContext context) {
    if (opacity <= 0) return const SizedBox.shrink();
    return IgnorePointer(
      child: ColoredBox(
        color: CaptureMirrorTokens.flashPearl.withValues(alpha: opacity),
      ),
    );
  }
}
