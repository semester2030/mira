import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../utils/fashion_color_binding.dart';

/// Compact look-chapter color strip — runtime garment HEX only (data, not tokens).
class OutfitGarmentColorStrip extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitGarmentColorStrip({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    final details = FashionColorBinding.garmentDetails(analysis);
    final entries = <({String label, Color color})>[];

    for (final d in details) {
      final color = FashionColorBinding.resolve(hex: d.hex, nameAr: d.nameAr);
      if (color == null) continue;
      entries.add((label: d.nameAr.isNotEmpty ? d.nameAr : d.hex, color: color));
      if (entries.length >= 6) break;
    }

    if (entries.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'ألوان القطعة',
          style: AppTypography.labelLarge.copyWith(
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            reverse: true,
            itemCount: entries.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final e = entries[index];
              final isLight = e.color.computeLuminance() > 0.78;
              return Column(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: e.color,
                      border: Border.all(
                        color: isLight ? AppColors.border : AppColors.onPrimary,
                        width: isLight ? 1.2 : 2,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}
