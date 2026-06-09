/// Outcome of on-device face validation before skin analysis.
class FaceGateResult {
  final bool isAccepted;
  final String messageAr;
  final String? reasonCode;

  const FaceGateResult._({
    required this.isAccepted,
    required this.messageAr,
    this.reasonCode,
  });

  const FaceGateResult.accepted()
      : this._(
          isAccepted: true,
          messageAr: 'وجه مقبول للتحليل',
        );

  const FaceGateResult.rejected({
    required String messageAr,
    required String reasonCode,
  }) : this._(
          isAccepted: false,
          messageAr: messageAr,
          reasonCode: reasonCode,
        );
}
