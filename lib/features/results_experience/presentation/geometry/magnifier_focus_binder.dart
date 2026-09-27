import 'dart:ui' show Offset;

/// Keeps user-chosen magnifier focus across rebuild / zoom / compare.
///
/// Focus is stored in **source-normalized** image space (0..1), never in
/// zoom-chip-relative viewport coords. Auto focus from mask signal only
/// applies when the user has not chosen a point for the current binding
/// (mask key + region + source fingerprint).
class MagnifierFocusBinder {
  Offset? _userSourceNorm;
  String? _userBindingKey;

  Offset? get userSourceNorm => _userSourceNorm;
  String? get userBindingKey => _userBindingKey;
  bool get hasUserFocus => _userSourceNorm != null && _userBindingKey != null;

  /// Call when the user taps the face image (not zoom chips).
  void setUserFocus({
    required Offset sourceNorm01,
    required String bindingKey,
  }) {
    _userSourceNorm = Offset(
      sourceNorm01.dx.clamp(0.0, 1.0),
      sourceNorm01.dy.clamp(0.0, 1.0),
    );
    _userBindingKey = bindingKey;
  }

  /// Clear when metric / region / source attempt changes — not on zoom/compare.
  void clearUserFocus() {
    _userSourceNorm = null;
    _userBindingKey = null;
  }

  /// Resolve display focus for the current binding (source-normalized).
  Offset? resolve({
    required String bindingKey,
    required Offset? autoSourceNorm,
  }) {
    if (_userSourceNorm != null && _userBindingKey == bindingKey) {
      return _userSourceNorm;
    }
    return autoSourceNorm;
  }

  /// True when auto focus must not overwrite the current user choice.
  bool shouldSkipAutoFor(String bindingKey) =>
      _userSourceNorm != null && _userBindingKey == bindingKey;
}
