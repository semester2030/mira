import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../domain/constants/report_face_map_spec.dart';

/// Left column — educational factor icons (reference layout).
class FaceMapFactorColumn extends StatelessWidget {
  final List<FaceMapFactor> factors;
  final Color accent;

  const FaceMapFactorColumn({
    super.key,
    required this.factors,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (var i = 0; i < factors.length; i++) ...[
          if (i > 0) const SizedBox(height: 14),
          _FactorItem(factor: factors[i], accent: accent),
        ],
      ],
    );
  }
}

class _FactorItem extends StatelessWidget {
  final FaceMapFactor factor;
  final Color accent;

  const _FactorItem({required this.factor, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.88),
            border: Border.all(color: accent.withValues(alpha: 0.22)),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Icon(factor.icon, size: 17, color: accent.withValues(alpha: 0.85)),
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: 52,
          child: Text(
            factor.labelAr,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.labelSmall.copyWith(
              fontSize: 9,
              height: 1.25,
              color: const Color(0xFF6B5B63),
            ),
          ),
        ),
      ],
    );
  }
}

/// Bottom-right intensity legend.
class FaceMapIntensityLegend extends StatelessWidget {
  final Color accent;

  const FaceMapIntensityLegend({super.key, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        _LegendRow(
          label: 'مناطق ظهور عالية',
          dot: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: ReportFaceMapSpec.highOpacity),
              shape: BoxShape.circle,
            ),
          ),
        ),
        const SizedBox(height: 6),
        _LegendRow(
          label: 'مناطق متوسطة',
          dot: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: ReportFaceMapSpec.mediumOpacity),
              shape: BoxShape.circle,
            ),
          ),
        ),
        const SizedBox(height: 6),
        _LegendRow(
          label: 'مناطق محتملة',
          dot: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: ReportFaceMapSpec.lowOpacity),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    );
  }
}

class _LegendRow extends StatelessWidget {
  final String label;
  final Widget dot;

  const _LegendRow({required this.label, required this.dot});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: AppTypography.labelSmall.copyWith(
            fontSize: 9,
            color: const Color(0xFF7A6B72),
          ),
        ),
        const SizedBox(width: 6),
        dot,
      ],
    );
  }
}
