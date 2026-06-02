import 'package:flutter/material.dart';

/// Suggested routine step — no product photos stored; icon + text only.
class SkinRoutineProduct {
  final String id;
  final String nameAr;
  final String nameEn;
  final String stepAr;
  final String stepEn;
  final IconData icon;
  final Color accent;

  const SkinRoutineProduct({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.stepAr,
    required this.stepEn,
    required this.icon,
    required this.accent,
  });
}
