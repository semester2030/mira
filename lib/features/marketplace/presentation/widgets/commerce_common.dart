import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/commerce_api_client.dart';

/// Arabic text for any commerce failure. Server messages are already Arabic and safe to show.
String commerceErrorText(Object error) {
  if (error is CommerceApiException) return error.messageAr;
  if (error is CommerceAuthException) return MarketplaceCopy.loginRequiredCart;
  return 'تعذر إكمال الطلب. حاولي مرة أخرى.';
}

/// Shown instead of a screen body when the customer is signed out.
class CommerceLoginRequired extends StatelessWidget {
  const CommerceLoginRequired({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, style: AppTypography.bodyLarge, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(context).pushNamed(AppRoutes.login),
              child: const Text(MarketplaceCopy.loginAction),
            ),
          ],
        ),
      ),
    );
  }
}

class CommerceErrorRetry extends StatelessWidget {
  const CommerceErrorRetry({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, style: AppTypography.bodyLarge, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}

/// Small rounded status label. Fulfillment and payment collection are separate chips.
class CommerceStatusChip extends StatelessWidget {
  const CommerceStatusChip(this.label, {super.key, this.tone = CommerceTone.neutral});

  final String label;
  final CommerceTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      CommerceTone.good => AppColors.primary,
      CommerceTone.bad => Colors.red.shade700,
      CommerceTone.neutral => AppColors.textSecondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(label, style: AppTypography.labelMedium.copyWith(color: color)),
    );
  }
}

enum CommerceTone { good, bad, neutral }

CommerceTone orderTone(String fulfillment) => switch (fulfillment) {
      'delivered' || 'accepted' || 'preparing' || 'out_for_delivery' => CommerceTone.good,
      'rejected' || 'cancelled' || 'failed_delivery' => CommerceTone.bad,
      _ => CommerceTone.neutral,
    };

CommerceTone bookingTone(String status) => switch (status) {
      'confirmed' || 'completed' => CommerceTone.good,
      'rejected' || 'cancelled' => CommerceTone.bad,
      _ => CommerceTone.neutral,
    };

/// Saudi Arabia has no DST: local time is UTC+3. Used for slot labels and the booking date keys.
DateTime riyadhTime(DateTime instant) => instant.toUtc().add(const Duration(hours: 3));

String twoDigits(int value) => value.toString().padLeft(2, '0');

String riyadhDateKey(DateTime instant) {
  final local = riyadhTime(instant);
  return '${local.year}-${twoDigits(local.month)}-${twoDigits(local.day)}';
}

String riyadhClock(DateTime instant) {
  final local = riyadhTime(instant);
  return '${twoDigits(local.hour)}:${twoDigits(local.minute)}';
}

String riyadhDateTimeLabel(DateTime? instant) {
  if (instant == null) return '—';
  return '${riyadhDateKey(instant)} ${riyadhClock(instant)}';
}
