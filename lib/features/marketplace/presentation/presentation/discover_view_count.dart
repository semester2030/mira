import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

enum DiscoverViewState { disabled, loading, available, unavailable }

/// A view count bound to one target. [count] exists only when the server confirmed it.
class DiscoverViewSnapshot {
  const DiscoverViewSnapshot({
    required this.state,
    required this.targetKind,
    required this.targetId,
    this.count,
    this.generation = 0,
  });

  const DiscoverViewSnapshot.disabled({required this.targetKind, required this.targetId})
      : state = DiscoverViewState.disabled,
        count = null,
        generation = 0;

  final DiscoverViewState state;
  final String targetKind;
  final String targetId;
  final int? count;
  final int generation;

  String get label => switch (state) {
        DiscoverViewState.disabled => 'المشاهدات غير مفعلة',
        DiscoverViewState.loading => 'جارٍ جلب العدد',
        DiscoverViewState.available => (count != null && count! > 0) ? '$count' : 'العدد غير متاح',
        DiscoverViewState.unavailable => 'تعذر جلب العدد',
      };

  String get displayMark => switch (state) {
        DiscoverViewState.disabled => '—',
        DiscoverViewState.loading => '',
        DiscoverViewState.available => (count != null && count! > 0) ? '$count' : '—',
        DiscoverViewState.unavailable => '—',
      };
}

/// Ignores a count response that belongs to an earlier slide.
class DiscoverViewLatch {
  String? _key;
  int generation = 0;
  DiscoverViewSnapshot current = const DiscoverViewSnapshot.disabled(targetKind: '', targetId: '');

  void bind(String targetKind, String targetId, {required bool countingEnabled}) {
    final key = '$targetKind:$targetId';
    if (key == _key) return;
    _key = key;
    generation += 1;
    current = DiscoverViewSnapshot(
      state: countingEnabled ? DiscoverViewState.loading : DiscoverViewState.disabled,
      targetKind: targetKind,
      targetId: targetId,
      generation: generation,
    );
  }

  bool apply(DiscoverViewSnapshot next) {
    if (next.generation != generation || next.targetKind != current.targetKind || next.targetId != current.targetId) {
      return false;
    }
    current = next;
    return true;
  }

  /// Reloads a failed count. It does not allocate a new generation and it does not record a view.
  bool retry() {
    if (current.state != DiscoverViewState.unavailable) return false;
    current = DiscoverViewSnapshot(
      state: DiscoverViewState.loading,
      targetKind: current.targetKind,
      targetId: current.targetId,
      generation: generation,
    );
    return true;
  }
}

/// Eye badge for the mid-right interaction column. Zero is never shown as a real count.
class DiscoverViewBadge extends StatelessWidget {
  const DiscoverViewBadge({super.key, required this.snapshot, this.onTap});

  final DiscoverViewSnapshot snapshot;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final showNumber = snapshot.state == DiscoverViewState.available && snapshot.count != null && snapshot.count! > 0;
    final interactive = onTap != null;
    final mark = showNumber ? '${snapshot.count}' : snapshot.displayMark;

    final body = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (snapshot.state == DiscoverViewState.loading)
          const SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        else
          Text(
            mark.isEmpty ? '—' : mark,
            style: AppTypography.labelSmall.copyWith(color: AppColors.textPrimary),
          ),
        const SizedBox(height: 2),
        Icon(Icons.visibility_outlined, color: AppColors.textPrimary, size: 20),
      ],
    );

    return Semantics(
      container: true,
      label: snapshot.label,
      button: interactive,
      child: ExcludeSemantics(
        child: ClipOval(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
            child: Material(
              color: AppColors.glassFill.withValues(alpha: 0.45),
              shape: CircleBorder(side: BorderSide(color: AppColors.border.withValues(alpha: 0.55))),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onTap,
                child: SizedBox(
                  width: 44,
                  height: 52,
                  child: Center(child: body),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
