import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Dart façade for the ONE Perfect CameraKit quality owner (iOS native).
/// Preview remains Flutter [CameraController] — frames are forwarded only.
abstract final class PerfectCameraKitGate {
  PerfectCameraKitGate._();

  static const _methods = MethodChannel('mira/perfect_camerakit');
  static const _events = EventChannel('mira/perfect_camerakit/quality');

  static const stableWindow = Duration(milliseconds: 800);

  static bool get isPlatformSupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  static bool _initialized = false;
  static String? _initError;
  static Map<String, dynamic>? _initMeta;
  static StreamSubscription<dynamic>? _sub;
  static PerfectCameraKitQuality? _latest;
  static DateTime? _readySince;
  static final _listeners = <void Function(PerfectCameraKitQuality)>[];

  static bool get isInitialized => _initialized;
  static String? get initError => _initError;
  static Map<String, dynamic>? get initMeta => _initMeta;
  static PerfectCameraKitQuality? get latest => _latest;

  static bool get isReady => _latest?.ready == true;

  /// Continuous ready for [stableWindow].
  static bool get isStableReady {
    final since = _readySince;
    if (!isReady || since == null) return false;
    return DateTime.now().difference(since) >= stableWindow;
  }

  static double get stableProgress01 {
    final since = _readySince;
    if (!isReady || since == null) return 0;
    final ms = DateTime.now().difference(since).inMilliseconds;
    return (ms / stableWindow.inMilliseconds).clamp(0.0, 1.0);
  }

  static void addListener(void Function(PerfectCameraKitQuality) fn) {
    _listeners.add(fn);
  }

  static void removeListener(void Function(PerfectCameraKitQuality) fn) {
    _listeners.remove(fn);
  }

  static Future<bool> initialize({String level = 'moderate'}) async {
    if (!isPlatformSupported) {
      _initError = 'Perfect CameraKit is iOS-only in this build';
      _initialized = false;
      return false;
    }
    try {
      final available = await _methods.invokeMethod<bool>('isAvailable');
      if (available != true) {
        _initError = 'Perfect CameraKit channel unavailable';
        return false;
      }
      final map = await _methods.invokeMethod<Map<dynamic, dynamic>>(
        'initialize',
      );
      if (map == null || map['ok'] != true) {
        _initError = 'CameraKit initialize returned not ok';
        _initialized = false;
        return false;
      }
      _initMeta = Map<String, dynamic>.from(map);
      debugPrint(
        'Mira PerfectCameraKit init: version=${_initMeta?['version']} '
        'level=${_initMeta?['level']} yaw=${_initMeta?['faceYaw']} '
        'size=${_initMeta?['faceSizeRatio']} '
        'lightL=${_initMeta?['lightingLower']} lightU=${_initMeta?['lightingUpper']} '
        'lightingOverride=${_initMeta?['lightingOverride']} '
        'overrideLower=${_initMeta?['lightingOverrideLower']}',
      );
      await _methods.invokeMethod<void>('setLevel', {'level': level});
      await _sub?.cancel();
      _sub = _events.receiveBroadcastStream().listen(_onEvent, onError: (_) {});
      _initialized = true;
      _initError = null;
      return true;
    } on PlatformException catch (e) {
      _initError = e.message ?? e.code;
      _initialized = false;
      return false;
    } catch (e) {
      _initError = e.toString();
      _initialized = false;
      return false;
    }
  }

  static Future<void> onCameraOpen({required bool isFront}) async {
    if (!_initialized) return;
    await _methods.invokeMethod<void>('onCameraOpen', {'isFront': isFront});
  }

  /// Forward NV12 frame from Flutter camera image stream (throttled).
  static DateTime? _lastFrameSent;
  static bool _frameInFlight = false;

  static Future<void> sendCameraImage(
    CameraImage image, {
    required bool isFront,
  }) async {
    if (!_initialized) return;
    if (image.format.group != ImageFormatGroup.yuv420) return;
    if (image.planes.length < 2) return;
    if (_frameInFlight) return;
    final now = DateTime.now();
    final last = _lastFrameSent;
    if (last != null && now.difference(last) < const Duration(milliseconds: 66)) {
      return;
    }
    _lastFrameSent = now;

    final y = image.planes[0];
    final u = image.planes.length > 2 ? image.planes[1] : null;
    final v = image.planes.length > 2 ? image.planes[2] : null;
    final uvPlane = image.planes.length == 2 ? image.planes[1] : null;

    Uint8List uvBytes;
    if (uvPlane != null) {
      uvBytes = uvPlane.bytes;
    } else if (u != null && v != null) {
      // Interleave UV for NV12 from planar YUV420.
      final uvLen = (image.width * image.height) ~/ 2;
      final out = Uint8List(uvLen);
      final uBytes = u.bytes;
      final vBytes = v.bytes;
      final count = (uvLen ~/ 2).clamp(0, uBytes.length).clamp(0, vBytes.length);
      for (var i = 0; i < count; i++) {
        out[i * 2] = uBytes[i];
        out[i * 2 + 1] = vBytes[i];
      }
      uvBytes = out;
    } else {
      return;
    }

    _frameInFlight = true;
    try {
      await _methods.invokeMethod<void>('sendFrameYv12', {
        'width': image.width,
        'height': image.height,
        'y': y.bytes,
        'uv': uvBytes,
        'yBytesPerRow': y.bytesPerRow,
        'uvBytesPerRow': uvPlane?.bytesPerRow ?? image.width,
        'isFront': isFront,
      });
    } catch (e) {
      debugPrint('Mira PerfectCameraKit sendFrame failed: $e');
    } finally {
      _frameInFlight = false;
    }
  }

  static Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
    _latest = null;
    _readySince = null;
    _lastFrameSent = null;
    _frameInFlight = false;
    if (_initialized) {
      try {
        await _methods.invokeMethod<void>('dispose');
      } catch (_) {}
    }
    _initialized = false;
  }

  static void _onEvent(dynamic raw) {
    if (raw is! Map) return;
    final q = PerfectCameraKitQuality.fromMap(
      Map<String, dynamic>.from(raw),
    );
    final wasReady = _latest?.ready == true;
    _latest = q;
    if (q.ready) {
      _readySince ??= DateTime.now();
    } else if (wasReady || !q.ready) {
      _readySince = null;
    }
    debugPrint(
      'Mira PerfectCameraKit quality: ready=${q.ready} valid=${q.isValid} '
      'area=${q.faceArea} pose=${q.facePose} light=${q.lighting} '
      'areaOk=${q.faceAreaOk} poseOk=${q.facePoseOk} lightOk=${q.lightingOk} '
      'code=${q.guidanceCode} deg=${q.facePoseDegree} '
      'stable=${PerfectCameraKitGate.isStableReady}',
    );
    for (final fn in List.of(_listeners)) {
      fn(q);
    }
  }
}

class PerfectCameraKitQuality {
  const PerfectCameraKitQuality({
    required this.ready,
    required this.isValid,
    required this.faceAreaOk,
    required this.facePoseOk,
    required this.lightingOk,
    required this.faceArea,
    required this.facePose,
    required this.lighting,
    required this.facePoseDegree,
    required this.guidanceCode,
  });

  final bool ready;
  final bool isValid;
  final bool faceAreaOk;
  final bool facePoseOk;
  final bool lightingOk;
  final String faceArea;
  final String facePose;
  final String lighting;
  final double facePoseDegree;
  final String guidanceCode;

  factory PerfectCameraKitQuality.fromMap(Map<String, dynamic> m) {
    return PerfectCameraKitQuality(
      ready: m['ready'] == true,
      isValid: m['isValid'] == true,
      faceAreaOk: m['faceAreaOk'] == true,
      facePoseOk: m['facePoseOk'] == true,
      lightingOk: m['lightingOk'] == true,
      faceArea: '${m['faceArea'] ?? 'unknown'}',
      facePose: '${m['facePose'] ?? 'unknown'}',
      lighting: '${m['lighting'] ?? 'unknown'}',
      facePoseDegree: (m['facePoseDegree'] as num?)?.toDouble() ?? 0,
      guidanceCode: '${m['guidanceCode'] ?? 'align'}',
    );
  }

  /// ONE Arabic instruction — no SDK jargon.
  String get guidanceAr {
    switch (guidanceCode) {
      case 'ready':
        return 'جاهزة';
      case 'too_far':
        return 'اقتربي قليلًا';
      case 'too_close':
        return 'ابتعدي قليلًا';
      case 'look_straight':
        return 'انظري مباشرة إلى الكاميرا';
      case 'lighting_low':
        return 'حسّني الإضاءة أمام وجهك';
      case 'lighting_high':
        return 'خفّفي الإضاءة القوية';
      case 'lighting_uneven':
        return 'اجعلي الإضاءة متساوية على الوجه';
      default:
        return 'ثبّتي وجهك بشكل مستقيم';
    }
  }
}
