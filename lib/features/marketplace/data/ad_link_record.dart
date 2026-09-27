/// Result of one attempt to store a link-open event.
///
/// [recorded] means the server stored the event or already had the same id for this ad.
/// It does not mean a purchase or a view. [retryable] is a transport or server failure
/// that can be sent again. [rejected] is a final API refusal, such as an unavailable ad
/// or an event id that belongs to another ad.
enum AdLinkRecordOutcome { recorded, retryable, rejected }

/// Cancels one in-flight link-record attempt.
///
/// The transport must observe [cancel]. Completing a Dart timeout without calling
/// this does not stop the underlying request.
class AdLinkAttemptControl {
  var _cancelled = false;
  final List<void Function()> _listeners = [];

  bool get cancelled => _cancelled;

  void onCancel(void Function() listener) {
    if (_cancelled) {
      listener();
      return;
    }
    _listeners.add(listener);
  }

  void cancel() {
    if (_cancelled) return;
    _cancelled = true;
    final listeners = List<void Function()>.of(_listeners);
    _listeners.clear();
    for (final listener in listeners) {
      listener();
    }
  }
}
