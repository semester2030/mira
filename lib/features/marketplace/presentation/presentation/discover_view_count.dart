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
        DiscoverViewState.disabled => 'العد غير مفعّل',
        DiscoverViewState.loading => 'جارٍ جلب العدد',
        DiscoverViewState.available => '${count ?? 0}',
        DiscoverViewState.unavailable => 'تعذر جلب العدد',
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

class DiscoverViewBadge extends StatelessWidget {
  const DiscoverViewBadge({super.key, required this.snapshot, required this.onTap});

  final DiscoverViewSnapshot snapshot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final showNumber = snapshot.state == DiscoverViewState.available && snapshot.count != null;
    return Semantics(
      label: snapshot.label,
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showNumber)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 4),
                child: Text('${snapshot.count}', style: AppTypography.labelSmall.copyWith(color: AppColors.textPrimary)),
              ),
            if (snapshot.state == DiscoverViewState.loading)
              const Padding(
                padding: EdgeInsetsDirectional.only(end: 4),
                child: SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            Icon(Icons.visibility_outlined, color: AppColors.textPrimary, size: 20),
          ],
        ),
      ),
    );
  }
}
