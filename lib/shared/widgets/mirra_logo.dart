import 'package:flutter/material.dart';

/// Widget موحّد لعرض شعار ميرا في جميع أنحاء التطبيق
class MirraLogo extends StatelessWidget {
  final double height;
  final double? width;
  final BoxFit fit;

  const MirraLogo({
    super.key,
    this.height = 40,
    this.width,
    this.fit = BoxFit.cover,
  });

  /// شعار صغير للـ AppBar
  const MirraLogo.small({
    super.key,
    this.height = 32,
    this.width,
    this.fit = BoxFit.cover,
  });

  /// شعار متوسط للشاشات الرئيسية
  const MirraLogo.medium({
    super.key,
    this.height = 80,
    this.width,
    this.fit = BoxFit.cover,
  });

  /// شعار كبير لشاشات الترحيب والتسجيل
  const MirraLogo.large({
    super.key,
    this.height = 200,
    this.width = 400,
    this.fit = BoxFit.contain,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Image.asset(
        'assets/images/app_icon.png',
        height: height,
        width: width,
        fit: fit,
      ),
    );
  }
}

