import 'package:flutter/material.dart';
import '../theme/colors.dart';

class LoadingIndicator extends StatelessWidget {
  final double size;
  const LoadingIndicator({super.key, this.size = 36});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: CircularProgressIndicator(
          strokeWidth: 4,
          valueColor: const AlwaysStoppedAnimation(AppColors.primary),
          backgroundColor: AppColors.accent.withAlpha((255 * 0.2).toInt()),
        ),
      ),
    );
  }
}
