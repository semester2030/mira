import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/navigation/route_args.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

/// Shared, calm entry into Mira's conversation from an analysis result.
class AskMiraEntry extends StatelessWidget {
  final String contextLine;
  final List<String> suggestions;
  final AdvisorRouteArgs Function(String? question) routeArgs;

  const AskMiraEntry({
    super.key,
    required this.contextLine,
    required this.suggestions,
    required this.routeArgs,
  });

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      key: const Key('ask_mira_entry'),
      onPressed: () {
        Navigator.pushNamed(
          context,
          AppRoutes.miraAdvisor,
          arguments: routeArgs(null),
        );
      },
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
      ),
      icon: const Icon(Icons.auto_awesome_rounded),
      label: Text(
        'اسألي ميرا ✨',
        style: AppTypography.titleSmall.copyWith(color: Colors.white),
      ),
    );
  }
}
