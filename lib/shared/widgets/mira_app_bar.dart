import 'package:flutter/material.dart';
import 'mirra_logo.dart';
import '../theme/typography.dart';

/// شريط علوي — نفس شعار ميرا الوحيد.
class MiraAppBar extends StatelessWidget implements PreferredSizeWidget {
  const MiraAppBar({super.key, this.pageTitle, this.actions});

  final String? pageTitle;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    if (pageTitle == null || pageTitle!.isEmpty) {
      return AppBar(
        centerTitle: true,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        title: const MirraLogo.appBar(),
      );
    }

    return AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      actions: actions,
      title: Row(
        children: [
          const MirraLogo.appBar(height: 36, width: 110),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              pageTitle!,
              style: AppTypography.titleMedium,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
