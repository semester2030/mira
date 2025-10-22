import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/animations.dart';

class CustomCheckbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final String? label;

  const CustomCheckbox({
    super.key,
    required this.value,
    required this.onChanged,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => onChanged(!value),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: AppAnimations.defaultDuration,
            curve: AppAnimations.defaultCurve,
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: value ? AppColors.primary : AppColors.card,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: value ? AppColors.primary : AppColors.border,
                width: 2,
              ),
              boxShadow: value
                  ? [BoxShadow(color: AppColors.primary.withAlpha((255 * 0.18).toInt()), blurRadius: 8, offset: const Offset(0, 2))]
                  : [],
            ),
            child: value
                ? const Icon(Icons.check, color: Colors.white, size: 18)
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
