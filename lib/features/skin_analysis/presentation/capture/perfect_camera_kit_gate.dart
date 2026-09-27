import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../debug/mira_measure_trace.dart';

/// Dart façade for the ONE Perfect CameraKit quality owner (iOS native).
/// Preview remains Flutter [CameraController] — frames are forwarded only.
abstract final class PerfectCameraKitGate {
  PerfectCameraKitGate._();

  static const _methods = MethodChannel('mira/perfect_camerakit');
  static const _events = EventChannel('mira/perfect_camerakit/quality');

  /// Wall-clock span of continuous fresh READY samples required for auto-capture.
  static const stableWindow = Duration(milliseconds: 800);

  /// READY older than this is treated as stale (callbacks throttle ~66ms).
  static const qualityFreshness = Duration(milliseconds: 350);

  static bool get isPlatformSupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  static bool _initialized = false;
  static String? _initError;
  static Map<String, dynamic>? _initMeta;
  static StreamSubscription<dynamic>? _sub;
  static PerfectCameraKitQuality? _latest;
  static final Stopwatch _mono = Stopwatch()..start();
  static int? _readySinceMonoMs;
  static int? _latestMonoMs;
  static int _sessionId = 0;
  static String? _staleReason;
  static final _listeners = <void Function(PerfectCameraKitQuality)>[];
  static bool _loggedFirstReady = false;

  /// Build identity for device-proof logs (not a secret).
  /// CKLIT-20260916B = lighting factor B: alwaysDiscardsLateVideoFrames=false (sample).
  static const buildProbeTag = 'CKLIT-20260916B';

  /// kCVPixelFormatType_420YpCbCr8BiPlanarFullRange ('420f').
  static const int fullRangeNv12 = 875704422;

  /// kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ('420v').
  static const int videoRangeNv12 = 875704438;

  /// Diagnostic ceiling only — does not change product READY thresholds.
  static const diagnosticAttemptCeiling = Duration(seconds: 30);

  static bool get isInitialized => _initialized;
  static String? get initError => _initError;
  static Map<String, dynamic>? get initMeta => _initMeta;
  static PerfectCameraKitQuality? get latest => _latest;
  static int get sessionId => _sessionId;
  static String? get staleReason => _staleReason;
  static bool get preferNativeFeed => _preferNativeFeed;
  static bool get nativeFeedActive => _nativeFeedActive;
  static String? get lastBlockReason => _lastBlockReason;
  static int? get attemptStartedMonoMs => _attemptStartedMonoMs;

  static bool _preferNativeFeed = false;
  static bool _nativeFeedActive = false;
  static String? _lastBlockReason;
  static int? _attemptStartedMonoMs;
  static int _attemptLogTick = 0;
  static String? _attemptId;
  static bool _ceilingAnnounced = false;

  static String? get attemptId => _attemptId;

  static bool get isReady {
    final q = _latest;
    final t = _latestMonoMs;
    if (q == null || t == null || !q.ready) return false;
    if (q.sessionId != _sessionId) {
      _staleReason = 'session_mismatch';
      return false;
    }
    final age = _mono.elapsedMilliseconds - t;
    if (age > qualityFreshness.inMilliseconds) {
      _staleReason = 'quality_stale_age_ms=$age';
      return false;
    }
    _staleReason = null;
    return true;
  }

  /// Continuous fresh READY for [stableWindow] without gaps longer than freshness.
  static bool get isStableReady {
    final since = _readySinceMonoMs;
    if (!isReady || since == null) return false;
    return _mono.elapsedMilliseconds - since >= stableWindow.inMilliseconds;
  }

  static double get stableProgress01 {
    final since = _readySinceMonoMs;
    if (!isReady || since == null) return 0;
    final ms = _mono.elapsedMilliseconds - since;
    return (ms / stableWindow.inMilliseconds).clamp(0.0, 1.0);
  }

  static void addListener(void Function(PerfectCameraKitQuality) fn) {
    _listeners.add(fn);
  }

  static void removeListener(void Function(PerfectCameraKitQuality) fn) {
    _listeners.remove(fn);
  }

  /// Single configuration path. Default = official MODERATE, no lighting override.
  /// Experimental lighting lower is opt-in only and must not be the production default.
  static Future<bool> initialize({
    String level = 'moderate',
    bool experimentalLightingLower = false,
  }) async {
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
      // ONE native configure: level first, then optional experimental overwrite.
      // Do NOT call setLevel again after this — SDK resets overwrite on setLevel.
      final map = await _methods.invokeMethod<Map<dynamic, dynamic>>(
        'initialize',
        {
          'level': level,
          'experimentalLightingLower': experimentalLightingLower,
          'buildProbe': buildProbeTag,
        },
      );
      if (map == null || map['ok'] != true) {
        _initError = 'CameraKit initialize returned not ok';
        _initialized = false;
        return false;
      }
      _initMeta = Map<String, dynamic>.from(map);
      _sessionId = (_initMeta?['sessionId'] as num?)?.toInt() ?? (_sessionId + 1);
      _preferNativeFeed = _initMeta?['preferNativeFeed'] == true;
      _nativeFeedActive = _initMeta?['nativeFeedActive'] == true;
      _lastBlockReason = null;
      _attemptStartedMonoMs = _mono.elapsedMilliseconds;
      _attemptLogTick = 0;
      _attemptId =
          'A${_sessionId}_${_attemptStartedMonoMs}_${buildProbeTag}';
      _ceilingAnnounced = false;
      _latest = null;
      _latestMonoMs = null;
      _readySinceMonoMs = null;
      _staleReason = null;
      _loggedFirstReady = false;
      debugPrint(
        'Mira PerfectCameraKit FINAL_CONFIG probe=$buildProbeTag '
        'session=$_sessionId version=${_initMeta?['version']} '
        'level=${_initMeta?['level']} yaw=${_initMeta?['faceYaw']} '
        'size=${_initMeta?['faceSizeRatio']} '
        'lightL=${_initMeta?['lightingLower']} lightU=${_initMeta?['lightingUpper']} '
        'experimentalLighting=${_initMeta?['experimentalLightingLower']} '
        'overrideApplied=${_initMeta?['lightingOverride']} '
        'preferNativeFeed=$_preferNativeFeed',
      );
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
    await _methods.invokeMethod<void>('onCameraOpen', {
      'isFront': isFront,
      'sessionId': _sessionId,
    });
  }

  static DateTime? _lastFrameSent;
  static bool _frameInFlight = false;

  static Future<void> sendCameraImage(
    CameraImage image, {
    required bool isFront,
  }) async {
    if (!_initialized) return;
    // Prefer native AVCapture tap. Skip Dart rebuild once native is live.
    // If the weak bridge never confirms within 2s, fall back to rebuild.
    if (_preferNativeFeed) {
      if (_nativeFeedActive) return;
      final started = _attemptStartedMonoMs ?? _mono.elapsedMilliseconds;
      if (_mono.elapsedMilliseconds - started < 2000) return;
    }
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

    // Reject truncated plane payloads before native rebuild.
    final minY = y.bytesPerRow * image.height;
    if (y.bytes.length < minY) {
      if (kDebugMode) {
        debugPrint(
          'Mira PerfectCameraKit drop frame: Y short '
          'have=${y.bytes.length} need>=$minY',
        );
      }
      return;
    }

    Uint8List uvBytes;
    int uvBytesPerRow;
    if (uvPlane != null) {
      final minUv = uvPlane.bytesPerRow * (image.height ~/ 2);
      if (uvPlane.bytes.length < minUv) {
        if (kDebugMode) {
          debugPrint(
            'Mira PerfectCameraKit drop frame: UV short '
            'have=${uvPlane.bytes.length} need>=$minUv',
          );
        }
        return;
      }
      uvBytes = uvPlane.bytes;
      uvBytesPerRow = uvPlane.bytesPerRow;
    } else if (u != null && v != null) {
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
      uvBytesPerRow = image.width;
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
        'uvBytesPerRow': uvBytesPerRow,
        'isFront': isFront,
        'sessionId': _sessionId,
        'receiveMonoMs': _mono.elapsedMilliseconds,
        // Pass raw OS format so native can skip VideoRange→FullRange expand
        // when the camera already delivers FullRange (sample contract).
        'pixelFormatRaw': image.format.raw,
      });
    } catch (e) {
      debugPrint('Mira PerfectCameraKit sendFrame failed: $e');
    } finally {
      // Channel ack only — native may still process asynchronously.
      _frameInFlight = false;
    }
  }

  static Future<void> dispose() async {
    final closing = _sessionId;
    await _sub?.cancel();
    _sub = null;
    _latest = null;
    _latestMonoMs = null;
    _readySinceMonoMs = null;
    _lastFrameSent = null;
    _frameInFlight = false;
    _staleReason = 'disposed';
    if (_initialized) {
      try {
        await _methods.invokeMethod<void>('dispose', {'sessionId': closing});
      } catch (_) {}
    }
    _initialized = false;
    _sessionId += 1; // invalidate deferred callbacks from closed session
  }

  static void _onEvent(dynamic raw) {
    if (raw is! Map) return;
    final q = PerfectCameraKitQuality.fromMap(
      Map<String, dynamic>.from(raw),
    );
    if (q.sessionId != 0 && q.sessionId != _sessionId) {
      if (kDebugMode) {
        debugPrint(
          'Mira PerfectCameraKit drop stale callback '
          'cbSession=${q.sessionId} live=$_sessionId',
        );
      }
      return;
    }
    final nowMs = _mono.elapsedMilliseconds;
    final prevMs = _latestMonoMs;
    _latest = q;
    _latestMonoMs = nowMs;
    if (q.feedSource != null && q.feedSource!.isNotEmpty) {
      _nativeFeedActive = q.nativeFeedActive || q.feedSource == 'native_avcapture';
    }
    if (q.blockReason != null && q.blockReason!.isNotEmpty) {
      _lastBlockReason = q.blockReason;
    } else if (!q.ready) {
      if (!q.faceAreaOk) {
        _lastBlockReason = 'engine_area';
      } else if (!q.facePoseOk) {
        _lastBlockReason = 'engine_pose';
      } else if (!q.lightingOk) {
        _lastBlockReason = 'engine_lighting';
      } else {
        _lastBlockReason = 'mira_gate';
      }
    } else if (!isReady) {
      _lastBlockReason = staleReason ?? 'freshness';
    } else if (!isStableReady) {
      _lastBlockReason = 'stability_window';
    } else {
      _lastBlockReason = 'none';
    }
    if (q.ready) {
      if (prevMs != null &&
          nowMs - prevMs > qualityFreshness.inMilliseconds) {
        _readySinceMonoMs = nowMs;
        _staleReason = 'ready_gap_reset';
      } else {
        _readySinceMonoMs ??= nowMs;
        _staleReason = null;
      }
      if (!_loggedFirstReady) {
        _loggedFirstReady = true;
        MiraMeasureTrace.span(
          'FIRST_READY',
          detail:
              'area=${q.faceArea} pose=${q.facePose} light=${q.lighting} '
              'feed=${q.feedSource} session=$_sessionId',
        );
      }
    } else {
      _readySinceMonoMs = null;
    }
    _logAttemptTick(q, nowMs);
    for (final fn in List.of(_listeners)) {
      fn(q);
    }
  }

  static void _logAttemptTick(PerfectCameraKitQuality q, int nowMs) {
    final started = _attemptStartedMonoMs;
    if (started == null) return;
    final elapsed = nowMs - started;
    final tick = elapsed ~/ 1000;
    if (tick == _attemptLogTick && tick > 0) return;
    _attemptLogTick = tick;
    debugPrint(
      'Mira CAPTURE_ATTEMPT attemptId=${_attemptId ?? "?"} '
      'probe=$buildProbeTag session=$_sessionId '
      'elapsedMs=$elapsed '
      'raw_light=${q.lighting} raw_area=${q.faceArea} raw_pose=${q.facePose} '
      'lightRaw=${q.lightingRaw} areaRaw=${q.faceAreaRaw} poseRaw=${q.facePoseRaw} '
      'engine_ready=${q.ready} mira_ready=$isReady mira_stable=$isStableReady '
      'block=${_lastBlockReason ?? "?"} feed=${q.feedSource ?? "?"} '
      'nativeFeed=$_nativeFeedActive '
      'ageMs=${_latestMonoMs == null ? -1 : nowMs - _latestMonoMs!} '
      'stableMs=${_readySinceMonoMs == null ? 0 : nowMs - _readySinceMonoMs!} '
      'msg=${q.guidanceAr}',
    );
    unawaited(_nativeLog(
      'CAPTURE_ATTEMPT attemptId=${_attemptId ?? "?"} probe=$buildProbeTag '
      'session=$_sessionId elapsedMs=$elapsed '
      'raw_light=${q.lighting} raw_area=${q.faceArea} raw_pose=${q.facePose} '
      'engine_ready=${q.ready} mira_ready=$isReady mira_stable=$isStableReady '
      'block=${_lastBlockReason ?? "?"} feed=${q.feedSource ?? "?"}',
    ));
    if (elapsed >= diagnosticAttemptCeiling.inMilliseconds && !isStableReady) {
      if (!_ceilingAnnounced) {
        _ceilingAnnounced = true;
        debugPrint(
          'Mira CAPTURE_ATTEMPT_CEILING attemptId=${_attemptId ?? "?"} '
          'probe=$buildProbeTag elapsedMs=$elapsed '
          'block=${_lastBlockReason ?? "?"} '
          'raw_light=${q.lighting} raw_area=${q.faceArea} raw_pose=${q.facePose} '
          'engine_ready=${q.ready} mira_ready=$isReady mira_stable=$isStableReady '
          'feed=${q.feedSource ?? "?"} '
          'NOTE=diagnostic_ceiling_only_product_thresholds_unchanged',
        );
        unawaited(_nativeLog(
          'CAPTURE_ATTEMPT_CEILING attemptId=${_attemptId ?? "?"} '
          'elapsedMs=$elapsed block=${_lastBlockReason ?? "?"} '
          'raw_light=${q.lighting} raw_area=${q.faceArea} raw_pose=${q.facePose}',
        ));
      }
    }
  }

  static Future<void> _nativeLog(String message) async {
    if (!_initialized) return;
    try {
      await _methods.invokeMethod<void>('logAttempt', {'message': message});
    } catch (_) {}
  }

  /// Reset attempt clock (call when capture UI becomes active).
  static void markAttemptStart() {
    _attemptStartedMonoMs = _mono.elapsedMilliseconds;
    _attemptLogTick = 0;
    _ceilingAnnounced = false;
    _attemptId = 'A${_sessionId}_${_attemptStartedMonoMs}_${buildProbeTag}';
  }

  static int get attemptElapsedMs {
    final started = _attemptStartedMonoMs;
    if (started == null) return 0;
    return _mono.elapsedMilliseconds - started;
  }

  static bool get diagnosticCeilingExceeded =>
      attemptElapsedMs >= diagnosticAttemptCeiling.inMilliseconds;

  /// Diagnostic ceiling UX — Arabic only; technical block codes stay in logs.
  static String guidanceArForBlock(String? block, PerfectCameraKitQuality? q) {
    final fromSdk = q?.guidanceAr;
    switch (block) {
      case 'engine_area':
        return fromSdk ?? 'ثبّتي وجهك داخل الإطار';
      case 'engine_pose':
        return 'انظري مباشرة إلى الكاميرا';
      case 'engine_lighting':
        // Map real lighting enum — never treat unknown as weak light.
        return fromSdk ?? 'ثبّتي وجهك — جاري تقييم الإضاءة';
      case 'stability_window':
        return 'ثبّتي وجهك لحظة';
      case 'freshness':
      case 'session_mismatch':
        return 'ثبّتي وجهك بشكل مستقيم';
      case 'none':
        return 'جاهزة';
      default:
        return fromSdk ?? 'ثبّتي وجهك بشكل مستقيم';
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
    required this.facePoseDegreeReliable,
    required this.guidanceCode,
    required this.sessionId,
    this.feedSource,
    this.nativeFeedActive = false,
    this.blockReason,
    this.lightingRaw,
    this.faceAreaRaw,
    this.facePoseRaw,
  });

  final bool ready;
  final bool isValid;
  final bool faceAreaOk;
  final bool facePoseOk;
  final bool lightingOk;
  final String faceArea;
  final String facePose;
  final String lighting;
  /// Null when SDK degree is not treated as a reliable measurement.
  final double? facePoseDegree;
  final bool facePoseDegreeReliable;
  final String guidanceCode;
  final int sessionId;
  final String? feedSource;
  final bool nativeFeedActive;
  final String? blockReason;
  final int? lightingRaw;
  final int? faceAreaRaw;
  final int? facePoseRaw;

  factory PerfectCameraKitQuality.fromMap(Map<String, dynamic> m) {
    final degRaw = m['facePoseDegree'];
    final degReliable = m['facePoseDegreeReliable'] == true;
    double? deg;
    if (degReliable && degRaw is num) {
      deg = degRaw.toDouble();
    } else if (degRaw is num && m.containsKey('facePoseDegreeReliable')) {
      // Present but marked unreliable — do not surface as a measurement.
      deg = null;
    } else if (degRaw is num) {
      // Legacy payloads without reliability flag: do not invent 0 as truth.
      deg = null;
    }
    return PerfectCameraKitQuality(
      ready: m['ready'] == true,
      isValid: m['isValid'] == true,
      faceAreaOk: m['faceAreaOk'] == true,
      facePoseOk: m['facePoseOk'] == true,
      lightingOk: m['lightingOk'] == true,
      faceArea: '${m['faceArea'] ?? 'unknown'}',
      facePose: '${m['facePose'] ?? 'unknown'}',
      lighting: '${m['lighting'] ?? 'unknown'}',
      facePoseDegree: deg,
      facePoseDegreeReliable: degReliable,
      guidanceCode: '${m['guidanceCode'] ?? 'align'}',
      sessionId: (m['sessionId'] as num?)?.toInt() ?? 0,
      feedSource: m['feedSource']?.toString(),
      nativeFeedActive: m['nativeFeedActive'] == true,
      blockReason: m['blockReason']?.toString(),
      lightingRaw: (m['lightingRaw'] as num?)?.toInt(),
      faceAreaRaw: (m['faceAreaRaw'] as num?)?.toInt(),
      facePoseRaw: (m['facePoseRaw'] as num?)?.toInt(),
    );
  }

  /// ONE Arabic instruction — no SDK jargon.
  /// Do not map lighting `unknown` to "weak light".
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
      case 'lighting_pending':
        return 'ثبّتي وجهك — جاري تقييم الإضاءة';
      default:
        return 'ثبّتي وجهك بشكل مستقيم';
    }
  }
}
