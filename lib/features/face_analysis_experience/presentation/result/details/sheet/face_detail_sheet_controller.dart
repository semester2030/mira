import 'package:flutter/material.dart';

import '../../../shared/face_experience_haptics.dart';
import '../../../shared/face_experience_motion.dart';
import '../../../shared/face_experience_tokens.dart';
import '../../tokens/face_result_tokens.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../analytics/face_detail_analytics.dart';
import 'face_detail_sheet.dart';

/// Opens a contextual detail bottom sheet over the Result Mirror.
Future<void> showFaceDetailSheet({
  required BuildContext context,
  required FaceDetailSheetVm vm,
  required ValueChanged<FaceDetailPrimaryActionKind> onPrimaryAction,
  ValueChanged<String>? onRelatedTap,
  String? relatedGuidanceLabel,
  VoidCallback? onOpenRelatedGuidance,
}) {
  FaceDetailAnalytics.opened(
    detailKey: vm.detailId,
    category: vm.type.name,
  );
  FaceExperienceHaptics.surfaceOpened();

  final reduce = FaceExperienceMotion.reduceMotionOf(context);
  final heightFactor = switch (vm.preferredSize) {
    FaceDetailSheetSize.compact => 0.38,
    FaceDetailSheetSize.medium => 0.52,
    FaceDetailSheetSize.expanded => 0.72,
  };

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: FaceExperienceTokens.sheetDark,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    transitionAnimationController: null,
    builder: (ctx) {
      final maxH = MediaQuery.sizeOf(ctx).height * heightFactor;
      return AnimatedSize(
        duration: reduce ? Duration.zero : FaceExperienceMotion.sheet,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH + 80),
          child: FaceDetailSheet(
            vm: vm,
            relatedGuidanceLabel: relatedGuidanceLabel,
            onOpenRelatedGuidance: onOpenRelatedGuidance == null
                ? null
                : () {
                    if (Navigator.of(ctx).canPop()) {
                      Navigator.of(ctx).pop();
                    }
                    FaceDetailAnalytics.closed(detailKey: vm.detailId);
                    onOpenRelatedGuidance();
                  },
            onPrimaryAction: (kind) {
              if (Navigator.of(ctx).canPop()) {
                Navigator.of(ctx).pop();
              }
              FaceDetailAnalytics.closed(detailKey: vm.detailId);
              if (kind == FaceDetailPrimaryActionKind.askMira) {
                FaceDetailAnalytics.advisorTapped(vm.detailId);
              } else if (kind == FaceDetailPrimaryActionKind.retake) {
                FaceDetailAnalytics.retakeTapped(vm.detailId);
              }
              onPrimaryAction(kind);
            },
            onRelatedTap: onRelatedTap == null
                ? null
                : (id) {
                    if (Navigator.of(ctx).canPop()) {
                      Navigator.of(ctx).pop();
                    }
                    FaceDetailAnalytics.closed(detailKey: vm.detailId);
                    onRelatedTap(id);
                  },
            onClose: () {
              if (Navigator.of(ctx).canPop()) {
                Navigator.of(ctx).pop();
              }
              FaceDetailAnalytics.closed(detailKey: vm.detailId);
            },
          ),
        ),
      );
    },
  ).whenComplete(() {
    // Barrier dismiss also closes — analytics best-effort already fired on actions.
  });
}

/// Shared glass surface color for sheets (mirrors 9F tokens).
Color get faceDetailSheetSurface => FaceResultTokens.glass;
