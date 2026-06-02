import 'package:flutter/material.dart';

import 'mirra_logo.dart';

/// شعار فقط — العبارة داخل ملف PNG، بدون نص إضافي.
class MirraBrandHeader extends StatelessWidget {
  final Widget logo;

  const MirraBrandHeader({super.key, required this.logo});

  const MirraBrandHeader.welcome({super.key}) : logo = const MirraLogo.large();

  const MirraBrandHeader.auth({super.key}) : logo = const MirraLogo.auth();

  const MirraBrandHeader.drawer({super.key}) : logo = const MirraLogo.drawerHeader();

  const MirraBrandHeader.splash({super.key}) : logo = const MirraLogo.large();

  const MirraBrandHeader.compact({super.key}) : logo = const MirraLogo.medium();

  @override
  Widget build(BuildContext context) => logo;
}
