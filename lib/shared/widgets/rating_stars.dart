import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/animations.dart';

class RatingStars extends StatelessWidget {
  final double rating;
  final int maxStars;
  final ValueChanged<double>? onRatingChanged;
  final double size;

  const RatingStars({
    super.key,
    required this.rating,
    this.maxStars = 5,
    this.onRatingChanged,
    this.size = 28,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(maxStars, (index) {
        final filled = index < rating.round();
        return GestureDetector(
          onTap: onRatingChanged != null ? () => onRatingChanged!(index + 1.0) : null,
          child: AnimatedScale(
            scale: filled ? 1.15 : 1.0,
            duration: AppAnimations.defaultDuration,
            child: Icon(
              filled ? Icons.star_rounded : Icons.star_border_rounded,
              color: filled ? AppColors.primary : AppColors.border,
              size: size,
            ),
          ),
        );
      }),
    );
  }
}
