/// Structured failure from Vision Platform — no silent fallbacks (Phase 7).
class VisionPlatformException implements Exception {
  const VisionPlatformException({
    required this.code,
    required this.message,
    this.userMessageAr,
  });

  final String code;
  final String message;
  final String? userMessageAr;

  @override
  String toString() => userMessageAr ?? message;
}
