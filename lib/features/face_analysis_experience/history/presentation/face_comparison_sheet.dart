import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../../presentation/result/tokens/face_result_tokens.dart';
import '../../presentation/shared/face_experience_haptics.dart';
import '../../presentation/shared/face_experience_motion.dart';
import '../../presentation/shared/face_experience_tokens.dart';
import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';

Future<void> showFaceComparisonSheet({
  required BuildContext context,
  required FaceComparisonVm comparison,
}) {
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
      final maxH = MediaQuery.sizeOf(ctx).height * 0.7;
      return AnimatedSize(
        duration: reduce ? Duration.zero : FaceExperienceMotion.sheet,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH + 40),
          child: FaceComparisonSheet(
            comparison: comparison,
            onClose: () {
              if (Navigator.of(ctx).canPop()) Navigator.of(ctx).pop();
            },
          ),
        ),
      );
    },
  );
}

class FaceComparisonSheet extends StatelessWidget {
  const FaceComparisonSheet({
    super.key,
    required this.comparison,
    required this.onClose,
  });

  final FaceComparisonVm comparison;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final blocked = !comparison.mayRender;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: SingleChildScrollView(
            child: Semantics(
              container: true,
              label: FaceHistoryCopy.comparisonTitle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    blocked
                        ? FaceHistoryCopy.incompatibleHeadline
                        : comparison.comparisonReasonAr,
                    key: Key(blocked
                        ? 'face_comparison_incompatible'
                        : 'face_comparison_sheet'),
                    style: AppTypography.titleMedium.copyWith(
                      color: FaceResultTokens.onGlass,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (blocked)
                    Text(
                      FaceHistoryCopy.incompatibleSupport,
                      style: AppTypography.bodySmall.copyWith(
                        color: FaceResultTokens.qualifier,
                        height: 1.35,
                      ),
                    )
                  else ...[
                    Text(
                      FaceHistoryCopy.comparableHeading,
                      style: AppTypography.titleSmall.copyWith(
                        color: FaceResultTokens.pearl,
                      ),
                    ),
                    const SizedBox(height: 10),
                    for (final item in comparison.comparableItems) ...[
                      _ItemCard(item: item),
                      const SizedBox(height: 8),
                    ],
                  ],
                  if (comparison.historicalOnlyItems.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      FaceHistoryCopy.historicalOnlyHeading,
                      style: AppTypography.titleSmall.copyWith(
                        color: FaceResultTokens.pearl,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final item in comparison.historicalOnlyItems) ...[
                      _ItemCard(item: item),
                      const SizedBox(height: 8),
                    ],
                  ],
                  for (final lim in comparison.limitationsAr) ...[
                    const SizedBox(height: 6),
                    Text(
                      lim,
                      style: AppTypography.bodySmall.copyWith(
                        color: FaceResultTokens.qualifier.withValues(alpha: 0.85),
                        fontSize: 11,
                      ),
                    ),
                  ],
                  TextButton(
                    key: const Key('face_comparison_close'),
                    onPressed: onClose,
                    child: Text(
                      FaceHistoryCopy.closeLabel,
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

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});
  final FaceComparisonItemVm item;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            item.labelAr,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.onGlass,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'الحالي: ${item.currentPresentationAr}',
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
            ),
          ),
          Text(
            'السابق: ${item.previousPresentationAr}',
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            item.userLanguageAr,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.pearl.withValues(alpha: 0.9),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
