import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../tokens/face_result_tokens.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../localization/face_detail_copy.dart';

class FaceDetailExplanation extends StatelessWidget {
  const FaceDetailExplanation({super.key, required this.vm});

  final FaceDetailSheetVm vm;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _block(FaceDetailCopy.whatHeading, vm.whatAr),
        const SizedBox(height: 10),
        _block(FaceDetailCopy.observationHeading, vm.observationAr),
        if (vm.meaningAr.isNotEmpty && vm.meaningAr != vm.observationAr) ...[
          const SizedBox(height: 10),
          _block(FaceDetailCopy.meaningHeading, vm.meaningAr),
        ],
      ],
    );
  }

  Widget _block(String heading, String body) {
    return Column(
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
            color: FaceResultTokens.onGlass.withValues(alpha: 0.9),
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
