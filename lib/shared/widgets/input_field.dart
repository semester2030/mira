import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/colors.dart';
import '../theme/borders.dart';
import '../theme/animations.dart';
import '../theme/text_styles.dart';
import '../theme/shadows.dart';

class InputField extends StatelessWidget {
  final String? label;
  final String? hint;
  final String? error;
  final bool enabled;
  final bool readOnly;
  final bool obscureText;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final List<TextInputFormatter>? inputFormatters;
  final Widget? prefix;
  final Widget? suffix;
  final int? maxLines;
  final int? minLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final bool autofocus;
  final EdgeInsetsGeometry? contentPadding;
  final bool filled;
  final Color? fillColor;
  final bool showBorder;
  final Color? borderColor;
  final double? borderWidth;
  final BorderRadius? borderRadius;
  final BoxShadow? shadow;

  const InputField({
    super.key,
    this.label,
    this.hint,
    this.error,
    this.enabled = true,
    this.readOnly = false,
    this.obscureText = false,
    this.controller,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onTap,
    this.inputFormatters,
    this.prefix,
    this.suffix,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.focusNode,
    this.autofocus = false,
    this.contentPadding,
    this.filled = true,
    this.fillColor,
    this.showBorder = true,
    this.borderColor,
    this.borderWidth,
    this.borderRadius,
    this.shadow,
  });

  @override
  Widget build(BuildContext context) {
    final hasError = error != null && error!.isNotEmpty;
    final isDisabled = !enabled;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: AppTextStyles.labelMedium.copyWith(
              color: isDisabled ? AppColors.textSecondary : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
        ],
        AnimatedContainer(
          duration: AppAnimations.defaultDuration,
          curve: AppAnimations.defaultCurve,
          decoration: BoxDecoration(
            color: filled ? (fillColor ?? AppColors.card) : Colors.transparent,
            borderRadius: borderRadius ?? AppBorders.inputRadius,
            border: showBorder
                ? Border.all(
                    color: hasError
                        ? AppColors.error
                        : (borderColor ?? AppColors.border),
                    width: borderWidth ?? 1.5,
                  )
                : null,
            boxShadow: shadow != null ? [shadow!] : (enabled ? AppShadows.input : []),
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            autofocus: autofocus,
            enabled: enabled,
            readOnly: readOnly,
            obscureText: obscureText,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            onChanged: onChanged,
            onTap: onTap,
            inputFormatters: inputFormatters,
            maxLines: maxLines,
            minLines: minLines,
            maxLength: maxLength,
            style: AppTextStyles.bodyMedium.copyWith(
              color: isDisabled ? AppColors.textSecondary : AppColors.textPrimary,
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: AppTextStyles.bodyMedium.copyWith(
                color: AppColors.textSecondary,
              ),
              prefixIcon: prefix,
              suffixIcon: suffix,
              contentPadding: contentPadding ??
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: InputBorder.none,
              isDense: true,
              counterText: '',
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 4),
          Text(
            error!,
            style: AppTextStyles.labelSmall.copyWith(
              color: AppColors.error,
            ),
          ),
        ],
      ],
    );
  }
}
