import 'package:flutter/material.dart';

import '../../tokens/face_result_tokens.dart';

class FaceDetailActionSection extends StatelessWidget {
  const FaceDetailActionSection({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: FaceResultTokens.actionAccent,
        foregroundColor: FaceResultTokens.onGlass,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(label),
    );
  }
}
