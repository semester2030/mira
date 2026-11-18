import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Device-pullable Discover evidence (wireless CoreDevice has no idevicesyslog).
///
/// Path on device:
/// `Library/Application Support/mira_discover_logs/mira_discover_device.log`
void miraDiscoverLog(String message) {
  debugPrint(message);
  DiscoverDeviceFileLog.instance.append(message);
}

class DiscoverDeviceFileLog {
  DiscoverDeviceFileLog._();

  static final DiscoverDeviceFileLog instance = DiscoverDeviceFileLog._();

  static const String relativeDir = 'mira_discover_logs';
  static const String fileName = 'mira_discover_device.log';

  /// Unit/widget tests hang if path_provider is invoked without a mock binding.
  /// Real devices/simulators keep file capture on.
  bool fileCaptureEnabled = Platform.environment['FLUTTER_TEST'] != 'true';

  File? _file;
  Future<void>? _ready;
  final List<String> _pending = <String>[];
  bool _writing = false;

  Future<void> _ensure() async {
    if (_file != null) return;
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/$relativeDir');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    _file = File('${dir.path}/$fileName');
  }

  void append(String message) {
    if (!fileCaptureEnabled) return;
    final line = '${DateTime.now().toUtc().toIso8601String()} $message';
    _pending.add(line);
    _drain();
  }

  void _drain() {
    if (_writing) return;
    _writing = true;
    scheduleMicrotask(() async {
      try {
        await (_ready ??= _ensure());
        final file = _file;
        if (file == null) return;
        while (_pending.isNotEmpty) {
          final batch = List<String>.from(_pending);
          _pending.clear();
          await file.writeAsString(
            '${batch.join('\n')}\n',
            mode: FileMode.append,
            flush: true,
          );
        }
      } catch (_) {
        // Best-effort evidence only — never break playback.
      } finally {
        _writing = false;
        if (_pending.isNotEmpty) _drain();
      }
    });
  }
}
