import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import 'outfit_result_chapters.dart';

/// Rotating «ميرا تقول» hint — chapter-aware, no sharing CTAs.
class OutfitMiraVoiceBubble extends StatefulWidget {
  final OutfitResultChapter chapter;

  const OutfitMiraVoiceBubble({super.key, required this.chapter});

  @override
  State<OutfitMiraVoiceBubble> createState() => _OutfitMiraVoiceBubbleState();
}

class _OutfitMiraVoiceBubbleState extends State<OutfitMiraVoiceBubble> {
  Timer? _timer;
  int _tick = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) setState(() => _tick++);
    });
  }

  @override
  void didUpdateWidget(covariant OutfitMiraVoiceBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.chapter != widget.chapter) {
      setState(() => _tick = 0);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = OutfitResultChapter.miraVoiceFor(widget.chapter, _tick);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 420),
      child: Container(
        key: ValueKey('$message-$_tick'),
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primaryLight.withValues(alpha: 0.55),
              AppColors.surface.withValues(alpha: 0.95),
            ],
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.22)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.12),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: AppColors.secondary, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ميرا تقول',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.secondary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message,
                    style: AppTypography.bodySmall.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
