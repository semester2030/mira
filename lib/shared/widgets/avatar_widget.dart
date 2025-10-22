import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/shadows.dart';

class AvatarWidget extends StatelessWidget {
  final String? imageUrl;
  final double size;
  final Color borderColor;

  const AvatarWidget({
    super.key,
    this.imageUrl,
    this.size = 56,
    this.borderColor = AppColors.primary,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: AppShadows.card,
        border: Border.all(color: borderColor, width: 2),
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(imageUrl!, fit: BoxFit.cover, width: size, height: size)
            : Icon(Icons.person, size: size * 0.7, color: AppColors.border),
      ),
    );
  }
}
