import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/borders.dart';
import '../theme/shadows.dart';

class MirraCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  const MirraCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.margin = const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppBorders.cardRadius,
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }
}
