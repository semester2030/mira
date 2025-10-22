import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/borders.dart';
import '../theme/shadows.dart';

class ExpansionTileCustom extends StatelessWidget {
  final String title;
  final Widget child;
  final bool initiallyExpanded;

  const ExpansionTileCustom({
    super.key,
    required this.title,
    required this.child,
    this.initiallyExpanded = false,
  });

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppBorders.cardRadius,
          boxShadow: AppShadows.card,
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: ExpansionTile(
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          initiallyExpanded: initiallyExpanded,
          iconColor: AppColors.primary,
          collapsedIconColor: AppColors.textSecondary,
          tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          childrenPadding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: child,
            ),
          ],
        ),
      ),
    );
  }
}
