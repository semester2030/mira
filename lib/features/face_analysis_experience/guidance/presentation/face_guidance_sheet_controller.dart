import 'package:flutter/material.dart';

import '../../presentation/result/tokens/face_result_tokens.dart';
import '../../presentation/shared/face_experience_haptics.dart';
import '../../presentation/shared/face_experience_motion.dart';
import '../../presentation/shared/face_experience_tokens.dart';
import '../analytics/face_guidance_analytics.dart';
import '../contracts/face_guidance_vms.dart';
import 'face_guidance_sheet.dart';

/// Opens compact Personal Guidance bottom sheet over Result Mirror.
Future<void> showFaceGuidanceSheet({
  required BuildContext context,
  required FaceGuidanceSurfaceVm surface,
  required void Function(FaceGuidanceItemVm item) onAction,
}) {
  FaceGuidanceAnalytics.viewed(
    surfaceId: surface.surfaceId,
    itemCount: surface.allItems.length,
  );
  FaceExperienceHaptics.surfaceOpened();

  final reduce = FaceExperienceMotion.reduceMotionOf(context);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: FaceExperienceTokens.sheetDark,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (ctx) {
      final maxH = MediaQuery.sizeOf(ctx).height * 0.62;
      return AnimatedSize(
        duration: reduce ? Duration.zero : FaceExperienceMotion.sheet,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH + 80),
          child: FaceGuidanceSheet(
            surface: surface,
            onAction: (item) {
              FaceGuidanceAnalytics.selected(item.guidanceId);
              FaceGuidanceAnalytics.actionTapped(
                guidanceId: item.guidanceId,
                action: item.primaryAction.name,
              );
              if (item.primaryAction == FaceGuidanceActionKind.askMira) {
                FaceGuidanceAnalytics.advisorTapped(item.guidanceId);
              }
              if (Navigator.of(ctx).canPop()) {
                Navigator.of(ctx).pop();
              }
              onAction(item);
            },
            onReasonToggle: (item) {
              FaceGuidanceAnalytics.reasonOpened(item.guidanceId);
            },
            onClose: () {
              if (Navigator.of(ctx).canPop()) {
                Navigator.of(ctx).pop();
              }
            },
          ),
        ),
      );
    },
  );
}

Color get faceGuidanceSheetSurface => FaceResultTokens.glass;
