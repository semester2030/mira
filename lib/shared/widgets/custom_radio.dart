import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/animations.dart';

class CustomRadio<T> extends StatelessWidget {
  final T value;
  final T groupValue;
  final ValueChanged<T> onChanged;
  final String? label;

  const CustomRadio({
    super.key,
    required this.value,
    required this.groupValue,
    required this.onChanged,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final selected = value == groupValue;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => onChanged(value),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: AppAnimations.defaultDuration,
            curve: AppAnimations.defaultCurve,
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? AppColors.primary : AppColors.card,
              border: Border.all(
                color: selected ? AppColors.primary : AppColors.border,
                width: 2,
              ),
              boxShadow: selected
                  ? [BoxShadow(color: AppColors.primary.withAlpha((255 * 0.18).toInt()), blurRadius: 8, offset: const Offset(0, 2))]
                  : [],
            ),
            child: selected
                ? Center(
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                    ),
                  )
                : null,
          ),
          if (label != null) ...[
            const SizedBox(width: 10),
            Text(label!, style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          ],
        ],
      ),
    );
  }
}
