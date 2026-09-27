import 'dart:async';
import 'dart:math';

import '../data/ad_link_record.dart';

/// A v4 UUID. The screen counter and the clock are not part of the id.
String newAdLinkEventId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

enum AdLinkQueueStatus { pending, recorded, rejected, abandoned }

typedef AdLinkSender = Future<AdLinkRecordOutcome> Function({
  required String adId,
  required String eventId,
  AdLinkAttemptControl? attempt,
});

/// Remembers link-open events after the presentation page is gone.
///
/// Limits, in order:
/// - [maxAttempts] sends, then the event is abandoned.
/// - [spacing] after the previous transport has finished, before the next send.
/// - [requestTimeout] cancels that attempt. The next send starts only after the
///   cancelled transport future settles. A Dart timeout by itself is not used.
/// - [retention] from the moment the id is created, for a pending event.
/// - [maxPending] events waiting to be recorded.
/// - [maxTerminal] finished statuses, and [terminalRetention] for how long they stay.
///
/// One event has at most one active transport. Abandoned is not recorded.
/// Closing the process drops the queue; this is not durable delivery.
class AdLinkOpenOutbox {
  AdLinkOpenOutbox({
    this.maxAttempts = 4,
    this.maxPending = 20,
    this.maxTerminal = 32,
    this.spacing = const Duration(seconds: 2),
    this.retention = const Duration(minutes: 10),
    this.terminalRetention = const Duration(minutes: 10),
    this.requestTimeout = const Duration(seconds: 8),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  static final shared = AdLinkOpenOutbox();

  final int maxAttempts;
  final int maxPending;
  final int maxTerminal;
  final Duration spacing;
  final Duration retention;
  final Duration terminalRetention;
  final Duration requestTimeout;
  final DateTime Function() _now;
  final List<_PendingLinkOpen> _pending = [];
  final Map<String, _TerminalLinkStatus> _terminal = {};
  int _epoch = 0;

  int get pendingCount => _pending.length;

  int get terminalCount => _terminal.length;

  int get activeTransportCount => _pending.where((item) => item.inFlight).length;

  AdLinkQueueStatus? statusOf(String eventId) {
    for (final item in _pending) {
      if (item.eventId == eventId) return AdLinkQueueStatus.pending;
    }
    return _terminal[eventId]?.status;
  }

  void reset() {
    _epoch += 1;
    for (final item in _pending) {
      item.timer?.cancel();
      item.attempt?.cancel();
    }
    _pending.clear();
    _terminal.clear();
  }

  /// Keeps [eventId] for every later attempt. A second enqueue of the same pair is ignored.
  void enqueue({required String adId, required String eventId, required AdLinkSender send}) {
    _sweep();
    _trimTerminal();
    if (_pending.any((item) => item.adId == adId && item.eventId == eventId)) return;
    final finished = _terminal[eventId]?.status;
    if (finished == AdLinkQueueStatus.recorded || finished == AdLinkQueueStatus.rejected) return;
    if (_pending.length >= maxPending) {
      final idle = _pending.where((item) => !item.inFlight).toList();
      if (idle.isEmpty) {
        _terminal[eventId] = _TerminalLinkStatus(AdLinkQueueStatus.abandoned, _now());
        _trimTerminal();
        return;
      }
      _finish(idle.first, AdLinkQueueStatus.abandoned);
    }
    final item = _PendingLinkOpen(adId, eventId, _now(), send);
    _pending.add(item);
    _send(item);
  }

  void _sweep() {
    final expired = _pending.where((item) => !item.inFlight && _expired(item)).toList();
    for (final item in expired) {
      _finish(item, AdLinkQueueStatus.abandoned);
    }
  }

  bool _expired(_PendingLinkOpen item) => _now().difference(item.createdAt) > retention;

  void _send(_PendingLinkOpen item) {
    if (item.inFlight || !_pending.contains(item)) return;
    if (item.attempts >= maxAttempts || _expired(item)) {
      _finish(item, AdLinkQueueStatus.abandoned);
      return;
    }
    final epoch = _epoch;
    final generation = item.generation + 1;
    item.generation = generation;
    item.inFlight = true;
    item.attempts += 1;
    final attempt = AdLinkAttemptControl();
    item.attempt = attempt;
    final timeout = Timer(requestTimeout, attempt.cancel);
    item.timer = timeout;
    Future<AdLinkRecordOutcome> pending;
    try {
      pending = item.send(adId: item.adId, eventId: item.eventId, attempt: attempt);
    } catch (_) {
      timeout.cancel();
      _settle(item, epoch, generation, AdLinkRecordOutcome.retryable, thrown: true);
      return;
    }
    pending.then((outcome) {
      _settle(item, epoch, generation, outcome);
    }).catchError((Object _) {
      _settle(item, epoch, generation, AdLinkRecordOutcome.retryable, thrown: true);
    });
  }

  void _settle(
    _PendingLinkOpen item,
    int epoch,
    int generation,
    AdLinkRecordOutcome outcome, {
    bool thrown = false,
  }) {
    if (item.settledGeneration == generation) return;
    item.settledGeneration = generation;
    item.timer?.cancel();
    item.timer = null;
    if (epoch != _epoch || item.generation != generation || !_pending.contains(item)) return;
    item.inFlight = false;
    item.attempt = null;
    if (!thrown && outcome == AdLinkRecordOutcome.recorded) {
      _finish(item, AdLinkQueueStatus.recorded);
    } else if (!thrown && outcome == AdLinkRecordOutcome.rejected) {
      _finish(item, AdLinkQueueStatus.rejected);
    } else {
      _schedule(item);
    }
  }

  void _schedule(_PendingLinkOpen item) {
    if (item.attempts >= maxAttempts || _expired(item)) {
      _finish(item, AdLinkQueueStatus.abandoned);
      return;
    }
    item.timer?.cancel();
    item.timer = Timer(spacing, () {
      if (_epoch != item.epochSeen) return;
      _send(item);
    });
    item.epochSeen = _epoch;
  }

  void _finish(_PendingLinkOpen item, AdLinkQueueStatus status) {
    item.timer?.cancel();
    item.timer = null;
    item.attempt?.cancel();
    item.attempt = null;
    item.inFlight = false;
    _pending.remove(item);
    _terminal[item.eventId] = _TerminalLinkStatus(status, _now());
    _trimTerminal();
  }

  void _trimTerminal() {
    final expired = [
      for (final entry in _terminal.entries)
        if (_now().difference(entry.value.at) > terminalRetention) entry.key,
    ];
    for (final key in expired) {
      _terminal.remove(key);
    }
    final oldest = _terminal.entries.toList()..sort((a, b) => a.value.at.compareTo(b.value.at));
    while (_terminal.length > maxTerminal && oldest.isNotEmpty) {
      _terminal.remove(oldest.removeAt(0).key);
    }
  }
}

class _TerminalLinkStatus {
  _TerminalLinkStatus(this.status, this.at);

  final AdLinkQueueStatus status;
  final DateTime at;
}

class _PendingLinkOpen {
  _PendingLinkOpen(this.adId, this.eventId, this.createdAt, this.send);

  final String adId;
  final String eventId;
  final DateTime createdAt;
  final AdLinkSender send;
  int attempts = 0;
  int generation = 0;
  int settledGeneration = 0;
  bool inFlight = false;
  Timer? timer;
  int epochSeen = 0;
  AdLinkAttemptControl? attempt;
}
