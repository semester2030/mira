import 'package:flutter/material.dart';

class AppAnimations {
  // مدة الأنيميشن الافتراضية
  static const Duration defaultDuration = Duration(milliseconds: 300);
  static const Duration fastDuration = Duration(milliseconds: 150);
  static const Duration slowDuration = Duration(milliseconds: 500);

  // منحنيات الأنيميشن
  static const Curve defaultCurve = Curves.easeInOut;
  static const Curve fastCurve = Curves.easeOut;
  static const Curve slowCurve = Curves.easeInOutCubic;

  // أنيميشن الظهور التدريجي
  static Widget fadeIn({
    required Widget child,
    Duration? duration,
    Curve? curve,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(begin: 0.0, end: 1.0),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن الدوران
  static Widget rotate({
    required Widget child,
    Duration? duration,
    Curve? curve,
    double? beginAngle,
    double? endAngle,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(
        begin: beginAngle ?? 0.0,
        end: endAngle ?? 360.0,
      ),
      builder: (context, value, child) {
        return Transform.rotate(
          angle: value * 3.14159 / 180,
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن التكبير والتصغير
  static Widget scale({
    required Widget child,
    Duration? duration,
    Curve? curve,
    double? beginScale,
    double? endScale,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(
        begin: beginScale ?? 0.0,
        end: endScale ?? 1.0,
      ),
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن الانزلاق
  static Widget slide({
    required Widget child,
    Duration? duration,
    Curve? curve,
    Offset? beginOffset,
    Offset? endOffset,
  }) {
    return TweenAnimationBuilder<Offset>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(
        begin: beginOffset ?? const Offset(0.0, 1.0),
        end: endOffset ?? Offset.zero,
      ),
      builder: (context, value, child) {
        return Transform.translate(
          offset: value,
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن النبض
  static Widget pulse({
    required Widget child,
    Duration? duration,
    Curve? curve,
    double? minScale,
    double? maxScale,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(
        begin: minScale ?? 0.95,
        end: maxScale ?? 1.05,
      ),
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن الاهتزاز
  static Widget shake({
    required Widget child,
    Duration? duration,
    Curve? curve,
    double? intensity,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration ?? defaultDuration,
      curve: curve ?? defaultCurve,
      tween: Tween(
        begin: 0.0,
        end: intensity ?? 10.0,
      ),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(
            value * (((value ~/ 2) % 2 == 0) ? 1 : -1),
            0.0,
          ),
          child: child,
        );
      },
      child: child,
    );
  }

  // أنيميشن التلاشي المتتابع
  static Widget staggeredFade({
    required List<Widget> children,
    Duration? duration,
    Curve? curve,
    int? staggerDelay,
  }) {
    return Column(
      children: List.generate(
        children.length,
        (index) => TweenAnimationBuilder<double>(
          duration: duration ?? defaultDuration,
          curve: curve ?? defaultCurve,
          tween: Tween(begin: 0.0, end: 1.0),
          builder: (context, value, child) {
            return Opacity(
              opacity: value,
              child: child,
            );
          },
          child: children[index],
        ),
      ),
    );
  }

  // أنيميشن التكبير المتتابع
  static Widget staggeredScale({
    required List<Widget> children,
    Duration? duration,
    Curve? curve,
    int? staggerDelay,
  }) {
    return Column(
      children: List.generate(
        children.length,
        (index) => TweenAnimationBuilder<double>(
          duration: duration ?? defaultDuration,
          curve: curve ?? defaultCurve,
          tween: Tween(begin: 0.0, end: 1.0),
          builder: (context, value, child) {
            return Transform.scale(
              scale: value,
              child: child,
            );
          },
          child: children[index],
        ),
      ),
    );
  }

  // أنيميشن الانزلاق المتتابع
  static Widget staggeredSlide({
    required List<Widget> children,
    Duration? duration,
    Curve? curve,
    int? staggerDelay,
  }) {
    return Column(
      children: List.generate(
        children.length,
        (index) => TweenAnimationBuilder<Offset>(
          duration: duration ?? defaultDuration,
          curve: curve ?? defaultCurve,
          tween: Tween(
            begin: const Offset(0.0, 1.0),
            end: Offset.zero,
          ),
          builder: (context, value, child) {
            return Transform.translate(
              offset: value,
              child: child,
            );
          },
          child: children[index],
        ),
      ),
    );
  }
}
