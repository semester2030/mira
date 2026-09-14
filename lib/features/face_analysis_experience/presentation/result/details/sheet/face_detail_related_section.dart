import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../tokens/face_result_tokens.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../localization/face_detail_copy.dart';

class FaceDetailRelatedSection extends StatelessWidget {
  const FaceDetailRelatedSection({
    super.key,
    required this.related,
    this.onTap,
  });

  final List<FaceDetailRelatedRef> related;
  final ValueChanged<String>? onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          FaceDetailCopy.relatedHeading,
          style: AppTypography.titleSmall.copyWith(
            color: FaceResultTokens.pearl,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final r in related)
              ActionChip(
                label: Text(
                  r.titleAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: FaceResultTokens.onGlass,
                  ),
                ),
                backgroundColor: FaceResultTokens.glass,
                side: BorderSide(color: FaceResultTokens.glassBorder),
                onPressed: onTap == null ? null : () => onTap!(r.detailRefId),
              ),
          ],
        ),
      ],
    );
  }
}
