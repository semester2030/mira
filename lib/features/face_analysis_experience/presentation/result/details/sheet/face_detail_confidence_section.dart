import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../tokens/face_result_tokens.dart';
import '../localization/face_detail_copy.dart';

class FaceDetailConfidenceSection extends StatelessWidget {
  const FaceDetailConfidenceSection({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _SoftNote(
      heading: FaceDetailCopy.confidenceHeading,
      body: text,
    );
  }
}

class FaceDetailLimitationSection extends StatelessWidget {
  const FaceDetailLimitationSection({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _SoftNote(heading: 'حدود العرض', body: text);
  }
}

class FaceDetailTruthBadge extends StatelessWidget {
  const FaceDetailTruthBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: FaceResultTokens.violet.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: FaceResultTokens.glassBorder),
      ),
      child: Text(
        label,
        style: AppTypography.bodySmall.copyWith(
          color: FaceResultTokens.qualifier,
          fontSize: 11,
          height: 1.35,
        ),
      ),
    );
  }
}

class _SoftNote extends StatelessWidget {
  const _SoftNote({required this.heading, required this.body});

  final String heading;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: FaceResultTokens.glass,
        borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
        border: Border.all(color: FaceResultTokens.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            heading,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.pearl,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.onGlass.withValues(alpha: 0.88),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
