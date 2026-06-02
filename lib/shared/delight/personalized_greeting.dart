import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/typography.dart';

/// Time-aware Arabic greeting for dashboard and home.
abstract final class PersonalizedGreeting {
  PersonalizedGreeting._();

  static String headline({required String name, bool isGuest = false}) {
    if (isGuest) return 'أهلاً بكِ في ميرا ✨';
    final first = _firstName(name);
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'صباح الجمال يا $first ✨';
    if (hour >= 12 && hour < 17) return 'مساء الأناقة يا $first 🌸';
    if (hour >= 17 && hour < 22) return 'مساء النور يا $first 💫';
    return 'ليلة هادئة يا $first 🌙';
  }

  static String subtitle({bool isGuest = false}) {
    if (isGuest) {
      return 'تصفّحي جميع خدمات ميرا — سجّلي لحفظ نتائجك الخاصة';
    }
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) {
      return 'اليوم مثالي للعناية ببشرتك وإطلالتك';
    }
    if (hour >= 12 && hour < 17) {
      return 'لحظة مثالية لتحليل سريع قبل خروجك';
    }
    return 'خصّصي وقتك للعناية — ميرا معكِ';
  }

  static String _firstName(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty || trimmed == 'ميرا' || trimmed == 'زائرة') {
      return 'جميلة';
    }
    return trimmed.split(RegExp(r'\s+')).first;
  }
}

class PersonalizedGreetingHeader extends StatelessWidget {
  final String name;
  final bool isGuest;

  const PersonalizedGreetingHeader({
    super.key,
    required this.name,
    this.isGuest = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          PersonalizedGreeting.headline(name: name, isGuest: isGuest),
          style: AppTypography.headlineLarge,
        ),
        const SizedBox(height: 6),
        Text(
          PersonalizedGreeting.subtitle(isGuest: isGuest),
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
