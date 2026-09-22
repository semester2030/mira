import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/perfect_mask_session.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import 'apple_person_matting_poc_bridge.dart';

/// Temporary internal comparison viewer for Apple portrait matting POC.
/// Modes: ORIGINAL / APPLE MATTE / BLACK BACKGROUND / BLACK + PERFECT MASK.
/// Not production Face Explorer. Not a new architecture owner.
class ApplePortraitMattingPocScreen extends StatefulWidget {
  const ApplePortraitMattingPocScreen({
    super.key,
    required this.sourceImagePath,
  });

  final String sourceImagePath;

  @override
  State<ApplePortraitMattingPocScreen> createState() =>
      _ApplePortraitMattingPocScreenState();
}

enum _PocMode { original, appleMatte, blackBackground, blackPlusPerfect }

class _ApplePortraitMattingPocScreenState
    extends State<ApplePortraitMattingPocScreen> {
  Uint8List? _sourceBytes;
  ApplePersonMattePocResult? _matte;
  PerfectMaskArtifact? _perfectMask;
  var _mode = _PocMode.original;
  var _loading = true;
  String? _error;
  int? _sourceDecodedW;
  int? _sourceDecodedH;
  int? _matteDecodedW;
  int? _matteDecodedH;
  int? _blackDecodedW;
  int? _blackDecodedH;
  int? _maskDecodedW;
  int? _maskDecodedH;
  double? _haloRingMean;
  double? _bgLeakPct;
  final int _manualOffset = 0;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bytes = await File(widget.sourceImagePath).readAsBytes();
      final srcDims = await _decodeDims(bytes);
      final session = AnalysisSession.lastPerfectMasks;
      PerfectMaskArtifact? mask;
      if (session != null) {
        for (final provider in session.providersWithMaskBytes()) {
          final metric =
              PerfectMaskSession.consumerMetricIdForProvider(provider);
          if (metric == null) continue;
          mask = session.lookup(consumerMetricId: metric);
          if (mask?.bytes != null && mask!.bytes!.isNotEmpty) break;
        }
      }

      final matte =
          await ApplePersonMattingPocBridge.generatePersonMatte(bytes);
      final alphaDims = await _decodeDims(matte.alphaPng);
      final blackDims = await _decodeDims(matte.blackCompositePng);
      int? maskW;
      int? maskH;
      if (mask?.bytes != null) {
        final md = await _decodeDims(mask!.bytes!);
        maskW = md.$1;
        maskH = md.$2;
      }

      final metrics = await compute(_pocEdgeMetricsIsolate, <String, dynamic>{
        'blackPng': matte.blackCompositePng,
        'alphaPng': matte.alphaPng,
      });

      if (!mounted) return;
      setState(() {
        _sourceBytes = bytes;
        _matte = matte;
        _perfectMask = mask;
        _sourceDecodedW = srcDims.$1;
        _sourceDecodedH = srcDims.$2;
        _matteDecodedW = alphaDims.$1;
        _matteDecodedH = alphaDims.$2;
        _blackDecodedW = blackDims.$1;
        _blackDecodedH = blackDims.$2;
        _maskDecodedW = maskW ?? mask?.width;
        _maskDecodedH = maskH ?? mask?.height;
        _haloRingMean = (metrics['haloRingMean'] as num?)?.toDouble();
        _bgLeakPct = (metrics['bgLeakPct'] as num?)?.toDouble();
        _loading = false;
        _mode = _PocMode.blackBackground;
      });

      debugPrint(
        'APPLE_MATTING_POC api=${matte.api} q=${matte.qualityLevel} '
        'src=${srcDims.$1}x${srcDims.$2} matte=${matte.width}x${matte.height} '
        'nativeMask=${matte.maskNativeWidth}x${matte.maskNativeHeight} '
        'ms=${matte.processingMs} halo=${metrics['haloRingMean']} '
        'leak%=${metrics['bgLeakPct']} mask=${maskW}x$maskH',
      );
    } catch (e, st) {
      debugPrint('APPLE_MATTING_POC_ERROR $e\n$st');
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<(int, int)> _decodeDims(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final w = frame.image.width;
    final h = frame.image.height;
    frame.image.dispose();
    return (w, h);
  }

  bool get _dimsMatch {
    final m = _matte;
    if (m == null || _sourceDecodedW == null || _sourceDecodedH == null) {
      return false;
    }
    final sameMatte = m.width == _sourceDecodedW &&
        m.height == _sourceDecodedH &&
        _matteDecodedW == _sourceDecodedW &&
        _matteDecodedH == _sourceDecodedH &&
        _blackDecodedW == _sourceDecodedW &&
        _blackDecodedH == _sourceDecodedH;
    if (!sameMatte) return false;
    if (_maskDecodedW == null || _maskDecodedH == null) return sameMatte;
    return _maskDecodedW == _sourceDecodedW &&
        _maskDecodedH == _sourceDecodedH;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          'POC Apple Matte',
          style: AppTypography.titleSmall.copyWith(color: Colors.white),
        ),
        actions: [
          IconButton(
            tooltip: 'أعد التشغيل',
            onPressed: _loading ? null : _bootstrap,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.white),
              )
            : _error != null
                ? Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      _error!,
                      style: AppTypography.bodyMedium.copyWith(
                        color: Colors.redAccent,
                      ),
                    ),
                  )
                : Column(
                    children: [
                      _ModeStrip(
                        mode: _mode,
                        onChanged: (m) {
                          HapticFeedback.selectionClick();
                          setState(() => _mode = m);
                        },
                      ),
                      Expanded(child: _buildViewer()),
                      _MetricsBar(
                        matte: _matte,
                        sourceW: _sourceDecodedW,
                        sourceH: _sourceDecodedH,
                        matteW: _matteDecodedW,
                        matteH: _matteDecodedH,
                        blackW: _blackDecodedW,
                        blackH: _blackDecodedH,
                        maskW: _maskDecodedW,
                        maskH: _maskDecodedH,
                        dimsMatch: _dimsMatch,
                        haloRingMean: _haloRingMean,
                        bgLeakPct: _bgLeakPct,
                        manualOffset: _manualOffset,
                        hasPerfect: _perfectMask?.bytes != null,
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildViewer() {
    final src = _sourceBytes;
    final matte = _matte;
    if (src == null || matte == null) {
      return const SizedBox.shrink();
    }

    final aspect = matte.width / matte.height;
    Widget child;
    switch (_mode) {
      case _PocMode.original:
        child = Image.memory(
          src,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        );
      case _PocMode.appleMatte:
        child = Image.memory(
          matte.alphaPng,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        );
      case _PocMode.blackBackground:
        child = Image.memory(
          matte.blackCompositePng,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        );
      case _PocMode.blackPlusPerfect:
        final maskBytes = _perfectMask?.bytes;
        child = Stack(
          fit: StackFit.expand,
          children: [
            Image.memory(
              matte.blackCompositePng,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
              gaplessPlayback: true,
            ),
            if (maskBytes != null && maskBytes.isNotEmpty)
              ColorFiltered(
                colorFilter: ColorFilter.mode(
                  SkinFaceMapVisualTokens.maskTintForConcern('pores'),
                  BlendMode.srcIn,
                ),
                child: Opacity(
                  opacity: 0.58,
                  child: Image.memory(
                    maskBytes,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    gaplessPlayback: true,
                  ),
                ),
              )
            else
              const Center(
                child: Text(
                  'لا توجد Perfect mask في الجلسة',
                  style: TextStyle(color: Colors.orangeAccent),
                ),
              ),
          ],
        );
    }

    return InteractiveViewer(
      minScale: 1,
      maxScale: 8,
      child: Center(
        child: AspectRatio(
          aspectRatio: aspect,
          child: ColoredBox(
            color: Colors.black,
            child: child,
          ),
        ),
      ),
    );
  }
}

class _ModeStrip extends StatelessWidget {
  const _ModeStrip({required this.mode, required this.onChanged});

  final _PocMode mode;
  final ValueChanged<_PocMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Row(
        children: [
          for (final m in _PocMode.values)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: Text(_label(m), style: const TextStyle(fontSize: 12)),
                selected: mode == m,
                onSelected: (_) => onChanged(m),
                selectedColor: AppColors.primary.withValues(alpha: 0.35),
                backgroundColor: const Color(0xFF1A1A1A),
                labelStyle: TextStyle(
                  color: mode == m ? Colors.white : Colors.white70,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _label(_PocMode m) {
    switch (m) {
      case _PocMode.original:
        return 'ORIGINAL';
      case _PocMode.appleMatte:
        return 'APPLE MATTE';
      case _PocMode.blackBackground:
        return 'BLACK BG';
      case _PocMode.blackPlusPerfect:
        return 'BLACK + PERFECT';
    }
  }
}

class _MetricsBar extends StatelessWidget {
  const _MetricsBar({
    required this.matte,
    required this.sourceW,
    required this.sourceH,
    required this.matteW,
    required this.matteH,
    required this.blackW,
    required this.blackH,
    required this.maskW,
    required this.maskH,
    required this.dimsMatch,
    required this.haloRingMean,
    required this.bgLeakPct,
    required this.manualOffset,
    required this.hasPerfect,
  });

  final ApplePersonMattePocResult? matte;
  final int? sourceW;
  final int? sourceH;
  final int? matteW;
  final int? matteH;
  final int? blackW;
  final int? blackH;
  final int? maskW;
  final int? maskH;
  final bool dimsMatch;
  final double? haloRingMean;
  final double? bgLeakPct;
  final int manualOffset;
  final bool hasPerfect;

  @override
  Widget build(BuildContext context) {
    final m = matte;
    final lines = <String>[
      'API: ${m?.api ?? "—"} · Q: ${m?.qualityLevel ?? "—"}',
      'IN: ${sourceW ?? "?"}×${sourceH ?? "?"}  '
          'MATTE: ${matteW ?? "?"}×${matteH ?? "?"}  '
          'OUT: ${blackW ?? "?"}×${blackH ?? "?"}',
      'Perfect mask: ${maskW ?? "—"}×${maskH ?? "—"} · present=$hasPerfect',
      'ALIGN dimsMatch=$dimsMatch · MANUAL_OFFSET=$manualOffset',
      'TIME: ${m?.processingMs ?? "—"} ms · '
          'nativeMask ${m?.maskNativeWidth ?? "?"}×${m?.maskNativeHeight ?? "?"}',
      'HALO_RING_MEAN: ${haloRingMean?.toStringAsFixed(2) ?? "—"}  '
          'BG_LEAK_%: ${bgLeakPct?.toStringAsFixed(3) ?? "—"}',
      'Owner visual judgment required — no production integration.',
    ];
    return Container(
      width: double.infinity,
      color: const Color(0xFF0A0A0A),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Text(
        lines.join('\n'),
        style: AppTypography.bodySmall.copyWith(
          color: Colors.white70,
          height: 1.35,
          fontFamily: 'Courier',
          fontSize: 11,
        ),
      ),
    );
  }
}

/// Isolate-safe edge metrics — no face pixels persisted.
Map<String, double> _pocEdgeMetricsIsolate(Map<String, dynamic> args) {
  final blackPng = args['blackPng'] as Uint8List;
  final alphaPng = args['alphaPng'] as Uint8List;
  final black = img.decodeImage(blackPng);
  final alpha = img.decodeImage(alphaPng);
  if (black == null || alpha == null) {
    return {'haloRingMean': -1, 'bgLeakPct': -1};
  }

  final w = black.width;
  final h = black.height;
  var bgCount = 0;
  var leakCount = 0;
  var ringSum = 0.0;
  var ringN = 0;

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final a = alpha.getPixel(x, y).r.toInt();
      final p = black.getPixel(x, y);
      final lum = (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b);
      if (a < 16) {
        bgCount++;
        if (lum > 8) leakCount++;
      } else if (a >= 16 && a < 96) {
        // Soft band near edge — halo probe on black composite.
        ringSum += lum;
        ringN++;
      }
    }
  }

  return {
    'haloRingMean': ringN == 0 ? 0.0 : ringSum / ringN,
    'bgLeakPct': bgCount == 0 ? 0.0 : (100.0 * leakCount / bgCount),
  };
}
