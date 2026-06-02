import 'package:flutter/material.dart';

import '../config/mira_features.dart';

/// Checks subscription limits before analysis — معطّل حالياً (كل شيء مجاني).
abstract final class SubscriptionGate {
  SubscriptionGate._();

  static Future<bool> canAnalyzeSkin(BuildContext context) async => _allow();

  static Future<bool> canAnalyzeOutfit(BuildContext context) async => _allow();

  static Future<bool> _allow() async {
    if (!MiraFeatures.subscriptionsEnabled) return true;
    // عند تفعيل الاشتراكات لاحقاً: أعد منطق الحدود والـ paywall هنا.
    return true;
  }
}
