import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Home entry: circular Mira portrait + name, RTL-end aligned under outfit card.
/// Single tap target opens the same advisor used from skin/outfit results.
class AskMiraHomeEntry extends StatelessWidget {
  const AskMiraHomeEntry({super.key, this.onOpened});

  final VoidCallback? onOpened;

  static const double avatarLogicalSize = 80;

  void _open(BuildContext context) {
    onOpened?.call();
    Navigator.pushNamed(context, AppRoutes.miraAdvisor);
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Semantics(
        button: true,
        label: 'اسألي ميرا',
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            key: const Key('ask_mira_home_entry'),
            onTap: () => _open(context),
            borderRadius: BorderRadius.circular(48),
            child: Padding(
              padding: const EdgeInsetsDirectional.only(
                start: 8,
                end: 0,
                top: 2,
                bottom: 2,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: avatarLogicalSize,
                    height: avatarLogicalSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Image.asset(
                      'assets/images/mira_ask_avatar.png',
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                      errorBuilder: (_, __, ___) => Container(
                        color: AppColors.cardPurple.withValues(alpha: 0.35),
                        alignment: Alignment.center,
                        child: Icon(
                          Icons.headset_mic_rounded,
                          color: AppColors.primaryDark,
                          size: 36,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  SizedBox(
                    width: avatarLogicalSize + 8,
                    child: Text(
                      'اسألي ميرا',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.labelMedium.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
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
