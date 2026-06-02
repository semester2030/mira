import 'package:flutter/material.dart';

/// شعار ميرا — PNG شفاف فقط، بدون إطار أو خلفية في الواجهة.
class MirraLogo extends StatelessWidget {
  static const assetPath = 'assets/images/mira_logo_full.png';
  static const _asset = assetPath;

  final double height;
  final double? width;
  final BoxFit fit;

  const MirraLogo({
    super.key,
    required this.height,
    this.width,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.small({
    super.key,
    this.height = 40,
    this.width = 120,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.appBar({
    super.key,
    this.height = 40,
    this.width = 120,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.auth({
    super.key,
    this.height = 260,
    this.width = 340,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.drawerHeader({
    super.key,
    this.height = 150,
    this.width = 300,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.medium({
    super.key,
    this.height = 200,
    this.width = 300,
    this.fit = BoxFit.contain,
  });

  const MirraLogo.large({
    super.key,
    this.height = 300,
    this.width = 360,
    this.fit = BoxFit.contain,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: width,
      child: Image.asset(
        _asset,
        fit: fit,
        filterQuality: FilterQuality.high,
        isAntiAlias: true,
        gaplessPlayback: true,
        excludeFromSemantics: true,
      ),
    );
  }
}
