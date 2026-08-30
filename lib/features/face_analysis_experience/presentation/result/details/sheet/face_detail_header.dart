import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../tokens/face_result_tokens.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../localization/face_detail_copy.dart';

class FaceDetailHeader extends StatelessWidget {
  const FaceDetailHeader({super.key, required this.vm});

  final FaceDetailSheetVm vm;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          vm.titleAr,
          style: AppTypography.titleLarge.copyWith(
            color: FaceResultTokens.onGlass,
          ),
        ),
        if (vm.valueLabelAr != null) ...[
          const SizedBox(height: 6),
          Text(
            vm.valueLabelAr!,
            style: AppTypography.titleLarge.copyWith(
              color: FaceResultTokens.pearl,
              fontWeight: FontWeight.w700,
              fontSize: 22,
            ),
          ),
        ],
        if (vm.region != null) ...[
          const SizedBox(height: 6),
          Text(
            FaceDetailCopy.regionLabel(vm.region!.name),
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
            ),
          ),
        ],
      ],
    );
  }
}
