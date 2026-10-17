import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../../domain/dialogue_history.dart';

/// Shows each chat image, or a visible failure for the one that did not load.
class ConsultationImageStrip extends StatelessWidget {
  final List<DialogueImageSlot> slots;

  const ConsultationImageStrip({super.key, required this.slots});

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final slot in slots)
            if (!slot.failed)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(slot.bytes!, width: 96, height: 96, fit: BoxFit.cover),
              )
            else
              Container(
                key: Key('image-failed-${slot.attachmentId}'),
                width: 96,
                height: 96,
                alignment: Alignment.center,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: const Color(0xFFFFF6E8),
                ),
                child: Text(
                  'تعذر تحميل الصورة',
                  textAlign: TextAlign.center,
                  style: AppTypography.labelSmall,
                ),
              ),
        ],
      ),
    );
  }
}
