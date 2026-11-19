import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/navigation/route_args.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

/// Shared entry into Mira's conversation from a result or marketplace detail.
///
/// Marketplace detail uses the rich card (avatar + chips + free-text). Other
/// surfaces keep the compact button when [compact] is true.
class AskMiraEntry extends StatelessWidget {
  final String contextLine;
  final List<String> suggestions;
  final AdvisorRouteArgs Function(String? question) routeArgs;

  /// Compact pink button. Product/service detail pass false for the approved card.
  final bool compact;

  /// Optional subtitle under the title (piece-specific).
  final String? subtitle;

  const AskMiraEntry({
    super.key,
    required this.contextLine,
    required this.suggestions,
    required this.routeArgs,
    this.compact = true,
    this.subtitle,
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
    if (compact) return _compact(context);
    return _richCard(context);
  }

  Widget _compact(BuildContext context) {
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

  Widget _richCard(BuildContext context) {
    final chips = suggestions.take(4).toList();
    return Container(
      key: const Key('ask_mira_entry'),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFCE8F0),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      contextLine.trim().isEmpty ? 'اسألي ميرا: مساعدتك الذكية' : contextLine,
                      style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
                      textAlign: TextAlign.right,
                    ),
                    if ((subtitle ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                        textAlign: TextAlign.right,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              ClipOval(
                child: Image.asset(
                  'assets/images/mira_ask_avatar.png',
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primaryLight,
                    child: Icon(Icons.face_retouching_natural, color: AppColors.brandBurgundy),
                  ),
                ),
              ),
            ],
          ),
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.end,
              children: [
                for (final q in chips)
                  Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      key: Key('ask_mira_chip_${q.hashCode}'),
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _open(context, q),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Text(
                          q,
                          style: AppTypography.labelMedium.copyWith(color: AppColors.brandBurgundy),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => _open(context, null),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Row(
                  children: [
                    Icon(Icons.arrow_back_ios_new, size: 16, color: AppColors.brandBurgundy),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'أو اكتبي سؤالك بطريقتك',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.chat_bubble_outline, size: 18, color: AppColors.brandBurgundy),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
