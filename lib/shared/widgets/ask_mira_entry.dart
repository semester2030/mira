import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/navigation/route_args.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

/// Shared entry into Mira's conversation from an analysis result.
class AskMiraEntry extends StatefulWidget {
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
  State<AskMiraEntry> createState() => _AskMiraEntryState();
}

class _AskMiraEntryState extends State<AskMiraEntry> with SingleTickerProviderStateMixin {
  late final AnimationController _motion;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _motion.stop();
    } else if (!_motion.isAnimating) {
      _motion.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  void _open(String? question) {
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: widget.routeArgs(question),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scale = Tween<double>(begin: 1, end: 1.04).animate(
      CurvedAnimation(parent: _motion, curve: Curves.easeInOut),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ScaleTransition(
          scale: scale,
          child: FilledButton.icon(
            key: const Key('ask_mira_entry'),
            onPressed: () => _open(null),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: AppColors.primaryDark,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.auto_awesome_rounded),
            label: Text('اسألي ميرا ✨', style: AppTypography.titleSmall),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          key: const Key('ask_mira_result_card'),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('خلّينا نفهم نتيجتك معًا', style: AppTypography.titleSmall),
              const SizedBox(height: 6),
              Text(widget.contextLine, style: AppTypography.bodySmall.copyWith(height: 1.4)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final question in widget.suggestions.take(3))
                    ActionChip(
                      label: Text(question),
                      onPressed: () => _open(question),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
