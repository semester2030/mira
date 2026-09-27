/// Single authorization helpers for Skin capture — no thresholds.
///
/// Invariant: HUD / button / handler must agree on [isButtonCaptureReady].
abstract final class SkinCaptureAuthorize {
  SkinCaptureAuthorize._();

  /// Visual READY + shutter authorization (not retake).
  static bool isButtonCaptureReady({
    required bool sessionInteractive,
    required bool meshCanonicalReady,
    required bool hasCapture,
  }) {
    if (hasCapture) return false;
    return sessionInteractive && meshCanonicalReady;
  }

  /// Manual tap may enter capture if live READY **or** the gesture was armed
  /// while READY was painted (prevents READY→NOT_READY flicker dead taps).
  /// Post-capture validation remains strict — this does not loosen gates.
  static bool mayEnterManualCapture({
    required bool liveAuthorized,
    required bool gestureArmedFromReadyUi,
  }) {
    return liveAuthorized || gestureArmedFromReadyUi;
  }

  /// Auto-capture may enter if live READY **or** hold completed and armed.
  /// Same canonical READY as manual; arm only covers flicker between fire and
  /// takePicture — does not loosen mesh gates.
  static bool mayEnterAutoCapture({
    required bool liveAuthorized,
    required bool holdArmedFromStableReady,
  }) {
    return liveAuthorized || holdArmedFromStableReady;
  }

  /// HUD must never intercept pointers (IgnorePointer / not over shutter).
  static const bool hudMustIgnorePointers = true;
}
