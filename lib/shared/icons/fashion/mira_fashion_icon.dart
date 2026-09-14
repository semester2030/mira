import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/colors.dart';
import 'mira_fashion_icon_id.dart';
import 'mira_fashion_icon_registry.dart';

/// Renders one canonical Fashion icon via registry (no scattered Phosphor/Material calls).
class MiraFashionIcon extends StatelessWidget {
  final MiraFashionIconId id;
  final MiraFashionIconState state;
  final MiraFashionIconSizeRole sizeRole;
  final Color? color;

  const MiraFashionIcon({
    super.key,
    required this.id,
    this.state = MiraFashionIconState.defaults,
    this.sizeRole = MiraFashionIconSizeRole.normal,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final spec = MiraFashionIconRegistry.byId(id);
    final size = sizeRole.pixels;
    final resolved = color ?? _colorForState(state);
    final semantic = spec.labelAr;

    Widget child;
    switch (spec.source) {
      case MiraFashionIconSource.phosphor:
        final iconData = state == MiraFashionIconState.selected
            ? (spec.phosphorFill ?? spec.phosphorRegular!)
            : spec.phosphorRegular!;
        child = Icon(iconData, size: size, color: resolved, semanticLabel: semantic);
      case MiraFashionIconSource.miraSvg:
        child = SvgPicture.asset(
          spec.assetPath!,
          width: size,
          height: size,
          colorFilter: ColorFilter.mode(resolved, BlendMode.srcIn),
          semanticsLabel: semantic,
          matchTextDirection: false,
        );
    }

    return ExcludeSemantics(
      excluding: false,
      child: child,
    );
  }

  static Color _colorForState(MiraFashionIconState state) {
    switch (state) {
      case MiraFashionIconState.defaults:
        return AppColors.textPrimary;
      case MiraFashionIconState.selected:
        return AppColors.secondary;
      case MiraFashionIconState.disabled:
        return AppColors.textTertiary.withValues(alpha: 0.38);
    }
  }
}

/// Container treatment for selected/default Fashion icon preview tiles.
class MiraFashionIconChrome extends StatelessWidget {
  final MiraFashionIconId id;
  final MiraFashionIconState state;
  final MiraFashionIconSizeRole sizeRole;

  const MiraFashionIconChrome({
    super.key,
    required this.id,
    required this.state,
    this.sizeRole = MiraFashionIconSizeRole.normal,
  });

  @override
  Widget build(BuildContext context) {
    final selected = state == MiraFashionIconState.selected;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected
            ? AppColors.cardPurple.withValues(alpha: 0.55)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected
              ? AppColors.secondary.withValues(alpha: 0.85)
              : AppColors.border.withValues(alpha: 0.55),
          width: selected ? 1.5 : 1,
        ),
      ),
      child: MiraFashionIcon(id: id, state: state, sizeRole: sizeRole),
    );
  }
}
