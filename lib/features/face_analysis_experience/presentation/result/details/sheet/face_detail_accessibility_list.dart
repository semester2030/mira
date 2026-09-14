import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../../../projection/contracts/face_result_vms.dart';
import '../../tokens/face_result_tokens.dart';
import '../localization/face_detail_copy.dart';

/// Non-visual accessibility list of available details (STEP 52).
class FaceDetailAccessibilityList extends StatelessWidget {
  const FaceDetailAccessibilityList({
    super.key,
    required this.projection,
    required this.onOpenDetailRef,
    required this.onOpenPrimary,
  });

  final FaceResultProjection projection;
  final ValueChanged<String> onOpenDetailRef;
  final VoidCallback onOpenPrimary;

  @override
  Widget build(BuildContext context) {
    final insights = projection.executiveSummary.insights;
    final primary = projection.executiveSummary.primary;

    return Semantics(
      container: true,
      label: FaceDetailCopy.availableDetailsLabel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            FaceDetailCopy.availableDetailsLabel,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.qualifier,
            ),
          ),
          const SizedBox(height: 6),
          if (primary != null)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(
                primary.titleAr,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.onGlass,
                ),
              ),
              subtitle: Text(
                primary.valueLabelAr,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.qualifier,
                ),
              ),
              onTap: onOpenPrimary,
            ),
          for (final i in insights)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(
                i.titleAr,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.onGlass,
                ),
              ),
              onTap: () => onOpenDetailRef(i.detailRef.id),
            ),
        ],
      ),
    );
  }
}
