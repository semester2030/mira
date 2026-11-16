import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Home entry: circular Mira portrait + name under outfit card.
///
/// Visual **right** in Arabic (RTL): use [AlignmentDirectional.centerStart]
/// because in RTL `start` = right edge and `end` = left edge.
class AskMiraHomeEntry extends StatefulWidget {
  const AskMiraHomeEntry({super.key, this.onOpened});

  final VoidCallback? onOpened;

  /// Large frame so face + mic read clearly on the home handoff.
  static const double avatarLogicalSize = 132;

  /// Exposed for layout tests — visual right under RTL Directionality.
  static const AlignmentGeometry homeAlignment = AlignmentDirectional.centerStart;

  @override
  State<AskMiraHomeEntry> createState() => _AskMiraHomeEntryState();
}

class _AskMiraHomeEntryState extends State<AskMiraHomeEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _breathe;
  late final Animation<double> _ring;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _breathe = CurvedAnimation(parent: _pulse, curve: Curves.easeInOut);
    _ring = Tween<double>(begin: 0.22, end: 0.72).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  void _open(BuildContext context) {
    widget.onOpened?.call();
    Navigator.pushNamed(context, AppRoutes.miraAdvisor);
  }

  @override
  Widget build(BuildContext context) {
    const size = AskMiraHomeEntry.avatarLogicalSize;
    return Align(
      alignment: AskMiraHomeEntry.homeAlignment,
      child: Semantics(
        button: true,
        label: 'اسألي ميرا',
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            key: const Key('ask_mira_home_entry'),
            onTap: () => _open(context),
            borderRadius: BorderRadius.circular(size),
            child: Padding(
              padding: const EdgeInsetsDirectional.only(
                start: 0,
                end: 8,
                top: 4,
                bottom: 4,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) {
                      final scale = 1.0 + (_breathe.value * 0.04);
                      final glow = _ring.value;
                      return Transform.scale(
                        scale: scale,
                        child: Container(
                          width: size,
                          height: size,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(
                                  alpha: 0.18 + glow * 0.28,
                                ),
                                blurRadius: 14 + glow * 18,
                                spreadRadius: 1 + glow * 3,
                              ),
                              BoxShadow(
                                color: AppColors.secondary.withValues(
                                  alpha: 0.08 + glow * 0.16,
                                ),
                                blurRadius: 22 + glow * 10,
                                spreadRadius: glow * 2,
                              ),
                            ],
                          ),
                          child: child,
                        ),
                      );
                    },
                    child: Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          width: 2.5,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      // Slight zoom so face + mic fill the frame without
                      // cutting forehead/chin (asset already has headroom).
                      child: Transform.scale(
                        scale: 1.18,
                        alignment: const Alignment(0, -0.05),
                        child: Image.asset(
                          'assets/images/mira_ask_avatar.png',
                          fit: BoxFit.cover,
                          alignment: const Alignment(0, -0.08),
                          gaplessPlayback: true,
                          filterQuality: FilterQuality.high,
                          errorBuilder: (_, __, ___) => Container(
                            color: AppColors.cardPurple.withValues(alpha: 0.35),
                            alignment: Alignment.center,
                            child: Icon(
                              Icons.headset_mic_rounded,
                              color: AppColors.primaryDark,
                              size: 52,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: size + 12,
                    child: Text(
                      'اسألي ميرا',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.titleMedium.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
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
