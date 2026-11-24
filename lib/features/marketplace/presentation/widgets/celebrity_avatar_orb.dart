import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Circular avatar + Arabic name for creator directory grids.
class CelebrityAvatarOrb extends StatelessWidget {
  const CelebrityAvatarOrb({
    super.key,
    required this.nameAr,
    required this.diameter,
    this.avatarUrl,
    this.onTap,
  });

  final String nameAr;
  final double diameter;
  final String? avatarUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final font = (diameter * 0.17).clamp(12.0, 16.0);
    return Semantics(
      button: onTap != null,
      label: nameAr,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: diameter,
              height: diameter,
              foregroundDecoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xffffe7f0), width: 1.7),
              ),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: const [
                  BoxShadow(
                    color: Color.fromRGBO(207, 55, 137, 0.18),
                    blurRadius: 8,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: ClipOval(
                child: _avatar(diameter),
              ),
            ),
            const SizedBox(height: 6),
            SizedBox(
              width: diameter + 8,
              child: Text(
                nameAr,
                textAlign: TextAlign.center,
                softWrap: true,
                maxLines: 3,
                overflow: TextOverflow.visible,
                style: AppTypography.bodySmall.copyWith(
                  fontSize: font,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _avatar(double d) {
    final url = avatarUrl;
    if (url != null && url.isNotEmpty) {
      return Image.network(
        url,
        fit: BoxFit.cover,
        width: d,
        height: d,
        errorBuilder: (_, __, ___) => _placeholder(d),
      );
    }
    return _placeholder(d);
  }

  Widget _placeholder(double d) {
    return ColoredBox(
      color: AppColors.primaryLight,
      child: Center(
        child: Text(
          nameAr.isNotEmpty ? nameAr[0] : '✨',
          style: AppTypography.titleLarge.copyWith(color: AppColors.primary),
        ),
      ),
    );
  }
}