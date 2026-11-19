import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/navigation/route_args.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

/// Shared entry into Mira's conversation from a result or marketplace detail.
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

  void _open(BuildContext context, String? question) {
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: routeArgs(question),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (contextLine.trim().isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              contextLine,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        FilledButton.icon(
          key: const Key('ask_mira_entry'),
          onPressed: () => _open(context, null),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
          ),
          icon: const Icon(Icons.auto_awesome_rounded),
          label: Text(
            'اسألي ميرا',
            style: AppTypography.titleSmall.copyWith(color: Colors.white),
          ),
        ),
        if (suggestions.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              for (final q in suggestions.take(3))
                ActionChip(
                  key: Key('ask_mira_chip_${q.hashCode}'),
                  label: Text(q, style: AppTypography.labelSmall),
                  onPressed: () => _open(context, q),
                ),
            ],
          ),
        ],
      ],
    );
  }
}
