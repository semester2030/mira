/// Trust level for outfit photo — product integrity gate.
enum OutfitResultTrustLevel {
  /// Full score + chapters + photo.
  trusted,

  /// Score with banner — approximate.
  degraded,

  /// No score — retake required.
  blocked,
}

class OutfitPhotoTrustResult {
  final bool isAccepted;
  final String messageAr;
  final String reasonCode;

  const OutfitPhotoTrustResult({
    required this.isAccepted,
    required this.messageAr,
    this.reasonCode = 'unknown',
  });

  static const accepted = OutfitPhotoTrustResult(
    isAccepted: true,
    messageAr: 'صورة إطلالة مقبولة',
    reasonCode: 'accepted',
  );
}

class OutfitResultTrust {
  final OutfitResultTrustLevel level;
  final String titleAr;
  final String messageAr;
  final String? detailAr;

  const OutfitResultTrust({
    required this.level,
    required this.titleAr,
    required this.messageAr,
    this.detailAr,
  });

  bool get isBlocked => level == OutfitResultTrustLevel.blocked;
  bool get isDegraded => level == OutfitResultTrustLevel.degraded;
  bool get isTrusted => level == OutfitResultTrustLevel.trusted;

  bool get showScore => level != OutfitResultTrustLevel.blocked;
  bool get showPhotoInHero => level == OutfitResultTrustLevel.trusted;
  bool get showFullStory => level != OutfitResultTrustLevel.blocked;
}
