import 'package:flutter/material.dart';
import '../theme/colors.dart';

class DividerWidget extends StatelessWidget {
  final double thickness;
  final double indent;
  final double endIndent;
  final Color? color;
  final double vertical;

  const DividerWidget({
    super.key,
    this.thickness = 1.2,
    this.indent = 0,
    this.endIndent = 0,
    this.color,
    this.vertical = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: vertical),
      child: Divider(
        thickness: thickness,
        indent: indent,
        endIndent: endIndent,
        color: color ?? AppColors.border,
        height: 0,
      ),
    );
  }
}
