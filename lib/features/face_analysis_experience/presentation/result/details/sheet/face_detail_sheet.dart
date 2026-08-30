import 'package:flutter/material.dart';

import '../../../../../../shared/theme/typography.dart';
import '../../tokens/face_result_tokens.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../localization/face_detail_copy.dart';
import 'face_detail_header.dart';
import 'face_detail_explanation.dart';
import 'face_detail_confidence_section.dart';
import 'face_detail_limitation_section.dart';
import 'face_detail_action_section.dart';
import 'face_detail_truth_badge.dart';
import 'face_detail_related_section.dart';

class FaceDetailSheet extends StatelessWidget {
  const FaceDetailSheet({
    super.key,
    required this.vm,
    required this.onPrimaryAction,
    required this.onClose,
    this.onRelatedTap,
    this.relatedGuidanceLabel,
    this.onOpenRelatedGuidance,
  });

  final FaceDetailSheetVm vm;
  final ValueChanged<FaceDetailPrimaryActionKind> onPrimaryAction;
  final VoidCallback onClose;
  final ValueChanged<String>? onRelatedTap;
  /// Compact 9H entry — only when guidance is tied to this detail.
  final String? relatedGuidanceLabel;
  final VoidCallback? onOpenRelatedGuidance;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: SingleChildScrollView(
            child: Semantics(
              container: true,
              label: vm.titleAr,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FaceDetailHeader(vm: vm),
                  const SizedBox(height: 12),
                  FaceDetailExplanation(vm: vm),
                  if (vm.truth.showToUser &&
                      vm.truth.publicLabelAr != null) ...[
                    const SizedBox(height: 10),
                    FaceDetailTruthBadge(label: vm.truth.publicLabelAr!),
                  ],
                  if (vm.confidenceAr != null) ...[
                    const SizedBox(height: 12),
                    FaceDetailConfidenceSection(text: vm.confidenceAr!),
                  ],
                  if (vm.limitationAr != null) ...[
                    const SizedBox(height: 10),
                    FaceDetailLimitationSection(text: vm.limitationAr!),
                  ],
                  if (vm.related.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    FaceDetailRelatedSection(
                      related: vm.related,
                      onTap: onRelatedTap,
                    ),
                  ],
                  if (relatedGuidanceLabel != null &&
                      onOpenRelatedGuidance != null) ...[
                    const SizedBox(height: 10),
                    TextButton(
                      key: const Key('face_detail_related_guidance'),
                      onPressed: onOpenRelatedGuidance,
                      child: Text(
                        relatedGuidanceLabel!,
                        style: AppTypography.bodySmall.copyWith(
                          color: FaceResultTokens.pearl,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FaceDetailActionSection(
                    label: vm.primaryActionLabelAr,
                    onPressed: () => onPrimaryAction(vm.primaryAction),
                  ),
                  TextButton(
                    key: const Key('face_detail_close'),
                    onPressed: onClose,
                    child: Text(
                      FaceDetailCopy.closeLabel,
                      style: AppTypography.bodySmall.copyWith(
                        color: FaceResultTokens.qualifier,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
