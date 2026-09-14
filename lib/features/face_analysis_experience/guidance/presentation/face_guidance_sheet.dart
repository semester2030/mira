import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../../presentation/result/tokens/face_result_tokens.dart';
import '../contracts/face_guidance_vms.dart';
import '../localization/face_guidance_copy.dart';

/// Compact Personal Guidance sheet — primary + ≤2 secondary, reason, one action.
class FaceGuidanceSheet extends StatefulWidget {
  const FaceGuidanceSheet({
    super.key,
    required this.surface,
    required this.onAction,
    required this.onClose,
    this.onReasonToggle,
  });

  final FaceGuidanceSurfaceVm surface;
  final void Function(FaceGuidanceItemVm item) onAction;
  final VoidCallback onClose;
  final void Function(FaceGuidanceItemVm item)? onReasonToggle;

  @override
  State<FaceGuidanceSheet> createState() => _FaceGuidanceSheetState();
}

class _FaceGuidanceSheetState extends State<FaceGuidanceSheet> {
  final Set<String> _reasonOpen = {};

  @override
  Widget build(BuildContext context) {
    final surface = widget.surface;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: SingleChildScrollView(
            child: Semantics(
              container: true,
              label: FaceGuidanceCopy.entryTitle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    FaceGuidanceCopy.entryTitle,
                    style: AppTypography.titleMedium.copyWith(
                      color: FaceResultTokens.onGlass,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    FaceGuidanceCopy.entrySubtitle,
                    style: AppTypography.bodySmall.copyWith(
                      color: FaceResultTokens.qualifier,
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (surface.empty) ...[
                    _EmptyGuidance(
                      headline: surface.emptyHeadlineAr,
                      support: surface.emptySupportAr,
                    ),
                  ] else ...[
                    if (surface.primary != null)
                      _GuidanceCard(
                        item: surface.primary!,
                        isPrimary: true,
                        reasonOpen:
                            _reasonOpen.contains(surface.primary!.guidanceId),
                        onToggleReason: () =>
                            _toggleReason(surface.primary!),
                        onAction: () => widget.onAction(surface.primary!),
                      ),
                    if (surface.secondary.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text(
                        FaceGuidanceCopy.secondaryHeading,
                        style: AppTypography.titleSmall.copyWith(
                          color: FaceResultTokens.pearl,
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final item in surface.secondary) ...[
                        _GuidanceCard(
                          item: item,
                          isPrimary: false,
                          reasonOpen: _reasonOpen.contains(item.guidanceId),
                          onToggleReason: () => _toggleReason(item),
                          onAction: () => widget.onAction(item),
                        ),
                        const SizedBox(height: 8),
                      ],
                    ],
                  ],
                  TextButton(
                    key: const Key('face_guidance_close'),
                    onPressed: widget.onClose,
                    child: Text(
                      FaceGuidanceCopy.closeAction,
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

  void _toggleReason(FaceGuidanceItemVm item) {
    setState(() {
      if (_reasonOpen.contains(item.guidanceId)) {
        _reasonOpen.remove(item.guidanceId);
      } else {
        _reasonOpen.add(item.guidanceId);
        widget.onReasonToggle?.call(item);
      }
    });
  }
}

class _EmptyGuidance extends StatelessWidget {
  const _EmptyGuidance({required this.headline, required this.support});

  final String headline;
  final String support;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('face_guidance_empty'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FaceResultTokens.glass,
        borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
        border: Border.all(color: FaceResultTokens.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            headline,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.onGlass,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            support,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _GuidanceCard extends StatelessWidget {
  const _GuidanceCard({
    required this.item,
    required this.isPrimary,
    required this.reasonOpen,
    required this.onToggleReason,
    required this.onAction,
  });

  final FaceGuidanceItemVm item;
  final bool isPrimary;
  final bool reasonOpen;
  final VoidCallback onToggleReason;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final levelLabel = FaceGuidanceCopy.personalizationLabelAr(
      item.personalizationLevel.name,
    );
    return Semantics(
      container: true,
      label: '${item.titleAr}. $levelLabel',
      child: Container(
        key: Key(isPrimary
            ? 'face_guidance_primary'
            : 'face_guidance_secondary_${item.guidanceId}'),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: FaceResultTokens.glass,
          borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
          border: Border.all(
            color: isPrimary
                ? FaceResultTokens.pearl.withValues(alpha: 0.45)
                : FaceResultTokens.glassBorder,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.titleAr,
                    style: AppTypography.titleSmall.copyWith(
                      color: FaceResultTokens.onGlass,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: FaceResultTokens.glassBorder),
                  ),
                  child: Text(
                    levelLabel,
                    style: AppTypography.bodySmall.copyWith(
                      color: FaceResultTokens.qualifier,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.bodyAr,
              style: AppTypography.bodySmall.copyWith(
                color: FaceResultTokens.qualifier,
                height: 1.35,
              ),
            ),
            if (item.confidencePresentationAr != null) ...[
              const SizedBox(height: 8),
              Text(
                item.confidencePresentationAr!,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.qualifier.withValues(alpha: 0.85),
                  fontSize: 11,
                ),
              ),
            ],
            if (item.limitationAr != null) ...[
              const SizedBox(height: 6),
              Text(
                item.limitationAr!,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.qualifier.withValues(alpha: 0.75),
                  fontSize: 11,
                ),
              ),
            ],
            const SizedBox(height: 8),
            InkWell(
              key: Key('face_guidance_reason_${item.guidanceId}'),
              onTap: onToggleReason,
              child: Row(
                children: [
                  Text(
                    item.reason.labelAr,
                    style: AppTypography.bodySmall.copyWith(
                      color: FaceResultTokens.pearl,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Icon(
                    reasonOpen
                        ? Icons.expand_less
                        : Icons.expand_more,
                    size: 18,
                    color: FaceResultTokens.pearl,
                  ),
                ],
              ),
            ),
            if (reasonOpen) ...[
              const SizedBox(height: 6),
              Text(
                item.reason.explanationAr,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.qualifier,
                  height: 1.35,
                ),
              ),
              if (item.reason.relatedResultTitleAr != null) ...[
                const SizedBox(height: 4),
                Text(
                  item.reason.relatedResultTitleAr!,
                  style: AppTypography.bodySmall.copyWith(
                    color: FaceResultTokens.pearl.withValues(alpha: 0.85),
                    fontSize: 11,
                  ),
                ),
              ],
              if (item.reason.qualificationAr != null) ...[
                const SizedBox(height: 4),
                Text(
                  item.reason.qualificationAr!,
                  style: AppTypography.bodySmall.copyWith(
                    color: FaceResultTokens.qualifier,
                    fontSize: 11,
                  ),
                ),
              ],
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: Key('face_guidance_action_${item.guidanceId}'),
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: FaceResultTokens.actionAccent,
                  foregroundColor: FaceResultTokens.onGlass,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(item.primaryActionLabelAr),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
