import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import '../../domain/face_map_session_provenance.dart';
import '../../domain/perfect_mask_session.dart';
import '../poc/apple_person_matting_poc_bridge.dart';

/// Snapshot of Face Explorer source image + optional face-only matte.
class FaceExplorerImageSnapshot {
  const FaceExplorerImageSnapshot({
    this.sourceBytes,
    this.sourceWidth,
    this.sourceHeight,
    this.faceOnlyBlackBytes,
    this.matteLoading = false,
    this.matteError,
  });

  final Uint8List? sourceBytes;
  final int? sourceWidth;
  final int? sourceHeight;
  final Uint8List? faceOnlyBlackBytes;
  final bool matteLoading;
  final String? matteError;

  FaceExplorerImageSnapshot copyWith({
    Uint8List? sourceBytes,
    int? sourceWidth,
    int? sourceHeight,
    Uint8List? faceOnlyBlackBytes,
    bool? matteLoading,
    String? matteError,
    bool clearFaceOnly = false,
    bool clearMatteError = false,
    bool clearSource = false,
  }) {
    return FaceExplorerImageSnapshot(
      sourceBytes: clearSource ? null : (sourceBytes ?? this.sourceBytes),
      sourceWidth: clearSource ? null : (sourceWidth ?? this.sourceWidth),
      sourceHeight: clearSource ? null : (sourceHeight ?? this.sourceHeight),
      faceOnlyBlackBytes: clearFaceOnly
          ? null
          : (faceOnlyBlackBytes ?? this.faceOnlyBlackBytes),
      matteLoading: matteLoading ?? this.matteLoading,
      matteError: clearMatteError ? null : (matteError ?? this.matteError),
    );
  }
}

/// Loads ephemeral capture bytes + Apple person matte with generation guards.
class FaceExplorerImageLoader {
  FaceExplorerImageLoader({
    required this.onChanged,
    required this.isMounted,
  });

  final VoidCallback onChanged;
  final bool Function() isMounted;

  FaceExplorerImageSnapshot snapshot = const FaceExplorerImageSnapshot();
  int _generation = 0;

  /// Current load generation — exposed for tests.
  int get generation => _generation;

  void invalidate() {
    _generation++;
  }

  Future<void> load({
    required String? path,
    required bool fromHistory,
    PerfectMaskSession? session,
  }) async {
    final gen = ++_generation;
    if (!_stillCurrent(gen)) return;
    // Do not pair the previous photograph with the next session's mask while
    // the new file is being decoded (matching dimensions alone are not enough).
    snapshot = const FaceExplorerImageSnapshot();
    onChanged();
    if (path == null || path.isEmpty || fromHistory) {
      return;
    }
    try {
      final bytes = await File(path).readAsBytes();
      final dims = await decodeDims(bytes);
      if (!_stillCurrent(gen)) return;
      snapshot = FaceExplorerImageSnapshot(
        sourceBytes: bytes,
        sourceWidth: dims.$1,
        sourceHeight: dims.$2,
      );
      onChanged();
      await FaceMapSessionProvenanceProbe.capture(
        session: session,
        facePath: path,
        faceWidth: dims.$1,
        faceHeight: dims.$2,
      );
      if (!_stillCurrent(gen)) return;
      await _generateFaceOnlyMatte(bytes, gen: gen, session: session);
    } catch (_) {
      if (!_stillCurrent(gen)) return;
      snapshot = const FaceExplorerImageSnapshot();
      onChanged();
    }
  }

  Future<void> _generateFaceOnlyMatte(
    Uint8List bytes, {
    required int gen,
    PerfectMaskSession? session,
  }) async {
    if (!_stillCurrent(gen)) return;
    snapshot = snapshot.copyWith(matteLoading: true, clearMatteError: true);
    onChanged();
    Object? lastError;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final matte =
            await ApplePersonMattingPocBridge.generatePersonMatte(bytes);
        final srcDims = await decodeDims(bytes);
        final blackDims = await decodeDims(matte.blackCompositePng);
        final dimsOk = matte.width == srcDims.$1 &&
            matte.height == srcDims.$2 &&
            blackDims.$1 == srcDims.$1 &&
            blackDims.$2 == srcDims.$2;
        if (!dimsOk) {
          throw StateError(
            'matte dims mismatch src=${srcDims.$1}x${srcDims.$2} '
            'matte=${matte.width}x${matte.height} '
            'black=${blackDims.$1}x${blackDims.$2}',
          );
        }
        if (session != null) {
          for (final provider in session.providersWithMaskBytes()) {
            final metric =
                PerfectMaskSession.consumerMetricIdForProvider(provider);
            if (metric == null) continue;
            final art = session.lookup(consumerMetricId: metric);
            if (art?.width != null &&
                art?.height != null &&
                (art!.width != matte.width || art.height != matte.height)) {
              debugPrint(
                'FACE_ONLY_MATTE warn perfect_meta=${art.width}x${art.height} '
                'matte=${matte.width}x${matte.height}',
              );
            }
            break;
          }
        }
        if (!_stillCurrent(gen)) return;
        snapshot = snapshot.copyWith(
          faceOnlyBlackBytes: matte.blackCompositePng,
          matteLoading: false,
          clearMatteError: true,
        );
        onChanged();
        debugPrint(
          'FACE_ONLY_MATTE ok ${matte.width}x${matte.height} '
          'ms=${matte.processingMs} api=${matte.api} gen=$gen',
        );
        return;
      } catch (e) {
        lastError = e;
        await Future<void>.delayed(Duration(milliseconds: 350 * (attempt + 1)));
        if (!_stillCurrent(gen)) return;
      }
    }
    if (!_stillCurrent(gen)) return;
    snapshot = snapshot.copyWith(
      matteLoading: false,
      matteError: 'matte_failed',
      clearFaceOnly: true,
    );
    onChanged();
    debugPrint('FACE_ONLY_MATTE_FAIL $lastError gen=$gen');
  }

  bool _stillCurrent(int gen) => isMounted() && gen == _generation;

  /// Decode PNG/JPEG dims and dispose codec/image frames.
  static Future<(int, int)> decodeDims(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    try {
      final frame = await codec.getNextFrame();
      final w = frame.image.width;
      final h = frame.image.height;
      frame.image.dispose();
      return (w, h);
    } finally {
      codec.dispose();
    }
  }

  Uint8List? displayBytes({required bool holdingOriginal}) {
    if (holdingOriginal) return snapshot.sourceBytes;
    return snapshot.faceOnlyBlackBytes ?? snapshot.sourceBytes;
  }
}
