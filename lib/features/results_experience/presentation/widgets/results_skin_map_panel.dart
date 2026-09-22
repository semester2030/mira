import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/spacing.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../domain/perfect_mask_session.dart';
import '../../domain/perfect_spatial_skin_concern_contract.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../../truth/skin_claim_policy.dart';
import '../../visibility/visibility_policy.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import '../icons/mira_skin_glyphs.dart';
import '../poc/apple_person_matting_poc_bridge.dart';
import 'perfect_mask_overlay.dart';
import 'perfect_mask_region_callout.dart';

/// Premium Interactive Skin Intelligence — ONE Face Explorer.
/// Spatial truth = Perfect masks via PerfectMaskSession + PerfectMaskOverlay.
/// Face-only black = Apple person matte (same pixel grid) under Perfect overlay.
class ResultsSkinMapPanel extends StatefulWidget {
  const ResultsSkinMapPanel({
    super.key,
    required this.map,
    required this.metrics,
    required this.onAskMira,
    required this.onInfoOpened,
    required this.onConcernSelected,
    required this.onUnavailable,
    this.onOpenRoutine,
    this.isStale = false,
    this.missingImage = false,
    this.externalConcernId,
    this.mapKey,
    this.ephemeralUserImagePath,
    this.fromHistory = false,
    this.maskSession,
  });

  final ResultMapVM map;
  final List<ResultMetricVM> metrics;
  final ValueChanged<String> onAskMira;
  final VoidCallback onInfoOpened;
  final ValueChanged<String?> onConcernSelected;
  final VoidCallback onUnavailable;
  final VoidCallback? onOpenRoutine;
  final bool isStale;
  final bool missingImage;
  final String? externalConcernId;
  final Key? mapKey;
  final String? ephemeralUserImagePath;
  final bool fromHistory;
  final PerfectMaskSession? maskSession;

  @override
  State<ResultsSkinMapPanel> createState() => ResultsSkinMapPanelState();
}

class ResultsSkinMapPanelState extends State<ResultsSkinMapPanel> {
  String? _selectedId;
  String? _selectedSubregion;
  var _holdingOriginal = false;
  var _showSubregionDetails = false;
  var _compareHintSeen = false;
  Uint8List? _sourceBytes;
  Uint8List? _faceOnlyBlackBytes;
  var _matteLoading = false;
  String? _matteError;
  var _loggedUnavailable = false;
  Alignment? _magnifierFocus;
  String? _magnifierFocusKey;

  /// Temporary on-device chain HUD (diagnostic builds only). No payloads.
  String? _maskChainHud;

  /// Single carousel order — inventory-backed Perfect services; no «المزيد».
  static const _carouselIds = <String>[
    'pigmentation',
    'age_spot',
    'acne',
    'pore',
    'pores',
    'oil',
    'oiliness',
    'wrinkle',
    'wrinkles',
    'redness',
    'texture',
    'hydration',
    'moisture',
    'radiance',
    'dark_circle',
    'eye_bag',
    'droopy_upper',
    'droopy_lower',
    'firmness',
    'tear_trough',
    'skin_type',
  ];

  List<ResultMapConcernVM> get _concerns => widget.map.concerns
      .where((c) => VisibilityPolicy.isPubliclyVisible(c.visibility))
      .toList();

  @override
  void initState() {
    super.initState();
    _selectedId = widget.externalConcernId;
    _loadSource();
  }

  @override
  void didUpdateWidget(covariant ResultsSkinMapPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.externalConcernId != oldWidget.externalConcernId) {
      _selectedId = widget.externalConcernId;
      _selectedSubregion = null;
      _showSubregionDetails = false;
      _magnifierFocus = null;
      _magnifierFocusKey = null;
    }
    if (widget.ephemeralUserImagePath != oldWidget.ephemeralUserImagePath) {
      _loadSource();
    }
  }

  Future<void> _loadSource() async {
    final path = widget.ephemeralUserImagePath;
    if (path == null || path.isEmpty || widget.fromHistory) {
      setState(() {
        _sourceBytes = null;
        _faceOnlyBlackBytes = null;
        _matteError = null;
        _matteLoading = false;
      });
      return;
    }
    try {
      final bytes = await File(path).readAsBytes();
      if (!mounted) return;
      setState(() {
        _sourceBytes = bytes;
        _faceOnlyBlackBytes = null;
        _matteError = null;
      });
      await _generateFaceOnlyMatte(bytes);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sourceBytes = null;
        _faceOnlyBlackBytes = null;
      });
    }
  }

  /// On-demand Apple person matte — same capture bytes Perfect analyzed.
  /// Never at app bootstrap; only when Face Explorer has an ephemeral image.
  Future<void> _generateFaceOnlyMatte(Uint8List bytes) async {
    setState(() {
      _matteLoading = true;
      _matteError = null;
    });
    Object? lastError;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final matte =
            await ApplePersonMattingPocBridge.generatePersonMatte(bytes);
        final srcDims = await _decodeDims(bytes);
        final blackDims = await _decodeDims(matte.blackCompositePng);
        // Alignment gate: matte grid must equal oriented source grid.
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
        // Soft check vs Perfect mask artifact metadata when present.
        final session = widget.maskSession;
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
                'matte=${matte.width}x${matte.height} — overlay uses BoxFit',
              );
            }
            break;
          }
        }
        if (!mounted) return;
        setState(() {
          _faceOnlyBlackBytes = matte.blackCompositePng;
          _matteLoading = false;
          _matteError = null;
        });
        debugPrint(
          'FACE_ONLY_MATTE ok ${matte.width}x${matte.height} '
          'ms=${matte.processingMs} api=${matte.api}',
        );
        return;
      } catch (e) {
        lastError = e;
        await Future<void>.delayed(Duration(milliseconds: 350 * (attempt + 1)));
      }
    }
    if (!mounted) return;
    setState(() {
      _matteLoading = false;
      _matteError = lastError?.toString() ?? 'matte_failed';
      _faceOnlyBlackBytes = null;
    });
    debugPrint('FACE_ONLY_MATTE_FAIL $lastError');
  }

  Future<(int, int)> _decodeDims(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final w = frame.image.width;
    final h = frame.image.height;
    frame.image.dispose();
    return (w, h);
  }

  /// Display base: face-only black when matte ready; full ORIGINAL while hold.
  Uint8List? get _displaySourceBytes {
    if (_holdingOriginal) return _sourceBytes;
    return _faceOnlyBlackBytes ?? _sourceBytes;
  }

  void selectConcern(String id) {
    HapticFeedback.selectionClick();
    if (_selectedId == id) {
      _clearToOriginal();
      return;
    }
    final carouselIds = _carouselConcerns().map((c) => c.id);
    final next = nextSelectedMaskKey(
      previousKey: _selectedId,
      nextKey: id,
      availableKeys: carouselIds,
    );
    final selected = next ?? id;
    setState(() {
      _selectedId = selected;
      _selectedSubregion = null;
      _showSubregionDetails = false;
      _holdingOriginal = false;
      _magnifierFocus = null;
      _magnifierFocusKey = null;
    });
    widget.onConcernSelected(_selectedId);
    _traceMaskRenderChain(selected);
  }

  /// Sanitized end-to-end probe — no mask/face payloads logged.
  void _traceMaskRenderChain(String metricId) {
    final session = widget.maskSession;
    final provider =
        PerfectMaskSession.providerTypeForConsumerMetric(metricId);
    final art = session?.lookup(consumerMetricId: metricId);
    final bytes = art?.bytes;
    final profile =
        SkinFaceMapVisualTokens.presentationProfileForConcern(metricId);
    final floorN = profile.luminanceGateFloor / 255.0;
    final expectedBias = profile.alphaMode == PerfectMaskAlphaMode.luminanceGate
        ? -floorN * profile.alphaGain
        : 0.0;
    var nonZero = -1;
    var rawAlpha = -1;
    var decodeOk = false;
    if (bytes != null && bytes.isNotEmpty) {
      nonZero = PerfectMaskMagnifierFocus.countPresentationSignalSamples(
        bytes: bytes,
        profile: profile,
      );
      rawAlpha = PerfectMaskMagnifierFocus.countRawNonZeroAlphaSamples(bytes);
      decodeOk = nonZero >= 0 && rawAlpha >= 0;
    }
    const layerOrder =
        'L1_BLACK→L2_APPLE_SUBJECT→L3_PERFECT_MASK→L4_UI';
    final bytesLen = bytes?.length ?? 0;
    final matState = session == null
        ? 'NO_SESSION'
        : bytesLen > 0
            ? 'SESSION_READY'
            : art == null
                ? 'SESSION_NO_ARTIFACT'
                : 'SESSION_EMPTY_BYTES';
    final hud =
        '${AnalysisSession.lastMaskCreateProof?.hudLine ?? "CREATE unknown"}\n'
        'DIAG $metricId→$provider\n'
        '$matState bytes=$bytesLen\n'
        'rawA=$rawAlpha pres=$nonZero\n'
        'dims=${art?.width ?? "?"}x${art?.height ?? "?"}\n'
        'ephemeralKeys=${AnalysisSession.lastMaskCreateProof?.rawCount ?? 0} '
        'L3>L2';
    debugPrint(
      'MASK_CHAIN tap=$metricId provider=$provider '
      'session=${session != null} art=${art != null} '
      'state=$matState bytes=$bytesLen dims=${art?.width}x${art?.height} '
      'decode=${decodeOk ? "PASS" : "FAIL"} rawAlphaSamples=$rawAlpha '
      'presentationSamples=$nonZero '
      'diagnostic=${SkinFaceMapVisualTokens.maskVisibilityDiagnostic} '
      'profile=${profile.alphaMode.name} floor=${profile.luminanceGateFloor} '
      'matrixBiasExpected=$expectedBias '
      'overlayAboveMatte=YES order=$layerOrder',
    );
    if (SkinFaceMapVisualTokens.maskVisibilityDiagnostic && mounted) {
      setState(() => _maskChainHud = hud);
    }
  }

  void _clearToOriginal() {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedId = null;
      _selectedSubregion = null;
      _showSubregionDetails = false;
      _holdingOriginal = false;
      _magnifierFocus = null;
      _magnifierFocusKey = null;
    });
    widget.onConcernSelected(null);
  }

  void _selectSubregion(String region) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedSubregion = region;
      _magnifierFocus = null;
      _magnifierFocusKey = null;
    });
  }

  /// ONE horizontal carousel — canonical Perfect availability (map + session).
  /// Visibility ≠ mask-byte readiness (bytes gate rendering only).
  List<ResultMapConcernVM> _carouselConcerns() {
    final byId = <String, ResultMapConcernVM>{
      for (final c in _concerns) c.id: c,
    };

    // Oiliness / HD services may exist in PerfectMaskSession but be absent
    // from report.mainConcerns → mapConcernIds. Use presence, not bytes.
    final session = widget.maskSession;
    if (session != null) {
      for (final provider in session.providersPresent()) {
        final consumer =
            PerfectMaskSession.consumerMetricIdForProvider(provider);
        if (consumer == null) continue;
        if (byId.keys.any(
          (id) =>
              PerfectMaskSession.providerTypeForConsumerMetric(id) == provider,
        )) {
          continue;
        }
        byId[consumer] = ResultMapConcernVM(
          id: consumer,
          labelAr: MetricPresentationPolicy.publicLabelAr(consumer),
          evidenceRef: 'perfect_mask:$provider',
          visibility: VisibilityState.visibleSecondary,
        );
      }
    }

    final ranked = <ResultMapConcernVM>[];
    for (final needle in _carouselIds) {
      for (final c in byId.values) {
        if (c.id.toLowerCase().contains(needle) &&
            !ranked.any((x) => x.id == c.id)) {
          ranked.add(c);
        }
      }
    }
    for (final c in byId.values) {
      if (!ranked.any((x) => x.id == c.id)) ranked.add(c);
    }

    final seen = <String>{};
    final out = <ResultMapConcernVM>[];
    for (final c in ranked) {
      final p = PerfectMaskSession.providerTypeForConsumerMetric(c.id) ?? c.id;
      if (seen.add(p)) out.add(c);
    }
    return out;
  }

  void _ensureMagnifierFocus({
    required PerfectMaskArtifact? mask,
    required PerfectMaskPresentationProfile profile,
    required String? selected,
  }) {
    if (selected == null ||
        mask?.bytes == null ||
        mask!.bytes!.isEmpty ||
        _holdingOriginal) {
      return;
    }
    final key =
        '${mask.key}:${profile.alphaMode}:${profile.luminanceGateFloor}:${profile.alphaGain}';
    if (_magnifierFocusKey == key) return;
    _magnifierFocusKey = key;
    final focus = PerfectMaskMagnifierFocus.fromMaskBytes(
      bytes: mask.bytes!,
      profile: profile,
    );
    // Schedule setState after build when focus resolves.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _magnifierFocusKey != key) return;
      if (_magnifierFocus != focus) {
        setState(() => _magnifierFocus = focus);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.maskSession;
    final hasMasks = session?.hasAnyMask == true && !widget.fromHistory;

    if (!hasMasks && !_loggedUnavailable) {
      _loggedUnavailable = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onUnavailable();
      });
    }

    final carousel = _carouselConcerns();
    final selected = _selectedId;
    // Black immersive chrome + face-only matte stage (#000).
    const atmosphere = SkinFaceMapVisualTokens.explorerBlack;

    if (widget.map.visibility == VisibilityState.unavailable &&
        carousel.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Text(
          widget.isStale
              ? 'تعذر عرض الاستكشاف — التحليل غير مكتمل أو قديم.'
              : 'تعذر عرض الاستكشاف حالياً.',
          style: AppTypography.bodyMedium.copyWith(
            color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    PerfectMaskArtifact? activeMask;
    if (selected != null && session != null) {
      activeMask = session.lookup(
        consumerMetricId: selected,
        subregion: _selectedSubregion,
      );
    }

    return AnimatedContainer(
      key: widget.mapKey,
      duration: SkinFaceMapVisualTokens.metricCrossfade,
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 16),
      decoration: BoxDecoration(
        color: atmosphere,
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  selected == null ? 'وجهك' : 'استكشاف بشرتك',
                  style: AppTypography.titleSmall.copyWith(
                    fontWeight: FontWeight.w800,
                    color: SkinFaceMapVisualTokens.explorerOnBlack,
                  ),
                ),
              ),
              if (selected != null)
                TextButton(
                  onPressed: _clearToOriginal,
                  style: TextButton.styleFrom(
                    foregroundColor: SkinFaceMapVisualTokens.explorerOnBlack,
                    minimumSize: const Size(48, 44),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Text(
                    'الأصل',
                    style: AppTypography.labelMedium.copyWith(
                      fontWeight: FontWeight.w800,
                      color: SkinFaceMapVisualTokens.explorerOnBlack,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_matteLoading)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'عزل الوجه…',
                style: AppTypography.labelSmall.copyWith(
                  color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                ),
                textAlign: TextAlign.center,
              ),
            )
          else if (_matteError != null && _faceOnlyBlackBytes == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'تعذر عزل الوجه — الخلفية الأصلية ظاهرة',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.warning,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          _buildFaceStage(session, selected, activeMask),
          if (selected != null &&
              !_holdingOriginal &&
              activeMask != null &&
              activeMask.bytes != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _ActiveMetricHero(
              metricId: selected,
              uiScore: activeMask.uiScore,
              accent: SkinFaceMapVisualTokens.accentForConcern(selected),
              onBlack: true,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _MetricCarousel(
            concerns: carousel,
            selectedId: selected,
            onSelect: selectConcern,
            onBlack: true,
          ),
          if (selected != null) ...[
            if (!_compareHintSeen) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'اضغطي مطولًا للمقارنة',
                style: AppTypography.labelSmall.copyWith(
                  color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            ..._buildSubregionDisclosure(session, selected),
          ] else ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              SkinClaimPolicy.mapPrecisionDisclaimerAr(),
              style: AppTypography.labelSmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFaceStage(
    PerfectMaskSession? session,
    String? selected,
    PerfectMaskArtifact? mask,
  ) {
    final source = _sourceBytes;
    final display = _displaySourceBytes;
    if (widget.missingImage ||
        source == null ||
        source.isEmpty ||
        display == null ||
        display.isEmpty) {
      return Semantics(
        label: 'صورة الوجه غير متاحة',
        child: Container(
          height: 420,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: SkinFaceMapVisualTokens.faceOnlyBlack,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Text(
              widget.fromHistory
                  ? 'الصورة غير متاحة من السجل.'
                  : 'صورة الوجه غير متاحة لهذه الجلسة.',
              style: AppTypography.bodySmall.copyWith(
                color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    var unavailable = false;
    if (selected != null) {
      // Missing session / empty bytes ⇒ unavailable (not selected-state-only silence).
      if (session == null ||
          mask == null ||
          mask.bytes == null ||
          mask.bytes!.isEmpty) {
        unavailable = true;
      }
    }

    final profile =
        SkinFaceMapVisualTokens.presentationProfileForConcern(selected);
    final tint = SkinFaceMapVisualTokens.maskTintForConcern(selected);
    final region = _selectedSubregion ?? 'whole';
    final showAnalysis = selected != null &&
        !_holdingOriginal &&
        !unavailable &&
        mask != null;
    final showRegionCallout = showAnalysis &&
        region != 'whole' &&
        region != 'all';
    final calloutAlign =
        SkinFaceMapVisualTokens.calloutAlignmentForSubregion(region);
    final calloutSelected = selected;
    final calloutMask = mask;
    final label = selected == null
        ? 'وجهك الأصلي'
        : MetricPresentationPolicy.publicLabelAr(selected);

    if (showAnalysis) {
      _ensureMagnifierFocus(
        mask: mask,
        profile: profile,
        selected: selected,
      );
    }

    final showMagnifier = showAnalysis && _magnifierFocus != null;
    final magnifierMaskBytes = mask?.bytes;
    final magnifierFocus = _magnifierFocus;

    return Semantics(
      label: label,
      button: selected != null,
      child: GestureDetector(
        onLongPressStart: selected == null
            ? null
            : (_) {
                HapticFeedback.lightImpact();
                setState(() {
                  _holdingOriginal = true;
                  _compareHintSeen = true;
                });
              },
        onLongPressEnd: selected == null
            ? null
            : (_) => setState(() => _holdingOriginal = false),
        onLongPressCancel: () => setState(() => _holdingOriginal = false),
        child: Column(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: ColoredBox(
                // LAYER 1 — pure black
                color: SkinFaceMapVisualTokens.faceOnlyBlack,
                child: Stack(
                  fit: StackFit.passthrough,
                  children: [
                    // LAYER 2 — Apple-matted subject (or ORIGINAL while hold)
                    // LAYER 3 — Perfect mask above subject (showMaskOnly stack)
                    PerfectMaskOverlay(
                      key: ValueKey<Object>(
                        Object.hash(
                          display.length,
                          mask?.key,
                          mask?.bytes?.length,
                          selected,
                          _holdingOriginal,
                          SkinFaceMapVisualTokens.maskVisibilityDiagnostic,
                          profile.alphaMode,
                          profile.luminanceGateFloor,
                          profile.alphaGain,
                        ),
                      ),
                      sourceBytes: display,
                      maskBytes: unavailable ? null : mask?.bytes,
                      tint: tint,
                      profile: profile,
                      showOriginalOnly:
                          selected == null || _holdingOriginal || unavailable,
                      // Keep subject+mask in one AspectRatio so fits stay aligned;
                      // mask paints after subject inside PerfectMaskOverlay Stack.
                      showMaskOnly: false,
                      applyTint: true,
                      forceDiagnosticTint:
                          SkinFaceMapVisualTokens.maskVisibilityDiagnostic,
                      opacity: SkinFaceMapVisualTokens.maskVisibilityDiagnostic
                          ? 1.0
                          : profile.opacity,
                      fadeDuration: _holdingOriginal
                          ? SkinFaceMapVisualTokens.comparisonSnap
                          : SkinFaceMapVisualTokens.metricCrossfade,
                    ),
                    if (SkinFaceMapVisualTokens.maskVisibilityDiagnostic)
                      Positioned(
                        left: 8,
                        top: 8,
                        right: 8,
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: const Color(0xCC000000),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: showAnalysis
                                    ? SkinFaceMapVisualTokens.diagnosticMaskTint
                                    : AppColors.warning,
                                width: 2,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                              child: Text(
                                _maskChainHud ??
                                    (unavailable
                                        ? 'DIAG NO_MASK_BYTES selected=$selected'
                                        : 'DIAG tap metric — await MASK_CHAIN'),
                                style: AppTypography.labelSmall.copyWith(
                                  color: SkinFaceMapVisualTokens
                                      .diagnosticMaskTint,
                                  fontWeight: FontWeight.w800,
                                  height: 1.25,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (showMagnifier &&
                        magnifierMaskBytes != null &&
                        magnifierFocus != null)
                      Positioned.fill(
                        child: Align(
                          alignment: AlignmentDirectional.topStart,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              textDirection: TextDirection.rtl,
                              children: [
                                _RealPerfectMagnifier(
                                  sourceBytes: display,
                                  maskBytes: magnifierMaskBytes,
                                  tint: tint,
                                  profile: profile,
                                  focus: magnifierFocus,
                                  opacity: profile.opacity,
                                ),
                                PerfectMaskCalloutConnector(accent: tint),
                                if (showRegionCallout &&
                                    calloutSelected != null &&
                                    calloutMask != null)
                                  PerfectMaskRegionCallout(
                                    regionLabelAr:
                                        MetricPresentationPolicy.subregionLabelAr(
                                      region,
                                    ),
                                    metricLabelAr:
                                        MetricPresentationPolicy.publicLabelAr(
                                      calloutSelected,
                                    ),
                                    uiScore: calloutMask.uiScore,
                                    accent: tint,
                                  )
                                else if (calloutSelected != null &&
                                    calloutMask != null &&
                                    calloutMask.uiScore != null)
                                  PerfectMaskRegionCallout(
                                    regionLabelAr:
                                        MetricPresentationPolicy.publicLabelAr(
                                      calloutSelected,
                                    ),
                                    metricLabelAr: 'تفصيل حقيقي',
                                    uiScore: calloutMask.uiScore,
                                    accent: tint,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      )
                    else if (showRegionCallout &&
                        calloutSelected != null &&
                        calloutMask != null)
                      Positioned.fill(
                        child: Align(
                          alignment: calloutAlign,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              textDirection: TextDirection.rtl,
                              children: [
                                PerfectMaskRegionCallout(
                                  regionLabelAr:
                                      MetricPresentationPolicy.subregionLabelAr(
                                    region,
                                  ),
                                  metricLabelAr:
                                      MetricPresentationPolicy.publicLabelAr(
                                    calloutSelected,
                                  ),
                                  uiScore: calloutMask.uiScore,
                                  accent: tint,
                                ),
                                PerfectMaskCalloutConnector(accent: tint),
                              ],
                            ),
                          ),
                        ),
                      ),
                    if (_holdingOriginal)
                      const Positioned(
                        right: 14,
                        top: 14,
                        child: _MetricPill(
                          label: 'الأصل',
                          accent: AppColors.textSecondary,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (unavailable && selected != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'التعيين غير متاح لهذا المؤشر حالياً.',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.warning,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _buildSubregionDisclosure(
    PerfectMaskSession? session,
    String selected,
  ) {
    if (session == null) return const [];
    final regions = session.providerSubregions(selected);
    if (regions.length <= 1) return const [];
    final provider =
        PerfectMaskSession.providerTypeForConsumerMetric(selected) ?? '';
    if (provider != 'hd_pore' && provider != 'hd_wrinkle') {
      return const [];
    }
    return [
      const SizedBox(height: AppSpacing.sm),
      Center(
        child: TextButton(
          onPressed: () {
            HapticFeedback.selectionClick();
            setState(() => _showSubregionDetails = !_showSubregionDetails);
          },
          style: TextButton.styleFrom(
            foregroundColor: SkinFaceMapVisualTokens.explorerOnBlack,
            minimumSize: const Size(48, 44),
          ),
          child: Text(
            _showSubregionDetails ? 'تم' : 'التفاصيل',
            style: AppTypography.labelMedium.copyWith(
              fontWeight: FontWeight.w700,
              color: SkinFaceMapVisualTokens.explorerOnBlack,
            ),
          ),
        ),
      ),
      if (_showSubregionDetails)
        AnimatedContainer(
          duration: SkinFaceMapVisualTokens.selectionTransition,
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
          decoration: BoxDecoration(
            color: AppColors.background.withValues(alpha: 0.65),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: regions.map((r) {
              final on = (_selectedSubregion ?? 'whole') == r;
              final label = MetricPresentationPolicy.subregionLabelAr(r);
              final accent =
                  SkinFaceMapVisualTokens.accentForConcern(selected);
              return Semantics(
                selected: on,
                button: true,
                label: label,
                child: Material(
                  color: on
                      ? accent.withValues(alpha: 0.22)
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => _selectSubregion(r),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 11,
                      ),
                      child: Text(
                        label,
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                          color: on
                              ? AppColors.primaryDark
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
    ];
  }
}

/// Crop of the SAME user image + SAME Perfect mask — no generated skin.
class _RealPerfectMagnifier extends StatelessWidget {
  const _RealPerfectMagnifier({
    required this.sourceBytes,
    required this.maskBytes,
    required this.tint,
    required this.profile,
    required this.focus,
    required this.opacity,
  });

  final Uint8List sourceBytes;
  final Uint8List maskBytes;
  final Color tint;
  final PerfectMaskPresentationProfile profile;
  final Alignment focus;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'تفصيل مكبر من التحليل الحقيقي',
      child: Container(
        width: 92,
        height: 92,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.analysisCalloutSurface, width: 2.5),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 10,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: ClipOval(
          child: Transform.scale(
            scale: 2.55,
            alignment: focus,
            child: PerfectMaskOverlay(
              sourceBytes: sourceBytes,
              maskBytes: maskBytes,
              tint: tint,
              profile: profile,
              opacity: opacity,
              fadeDuration: Duration.zero,
            ),
          ),
        ),
      ),
    );
  }
}

class _ActiveMetricHero extends StatelessWidget {
  const _ActiveMetricHero({
    required this.metricId,
    required this.uiScore,
    required this.accent,
    this.onBlack = false,
  });

  final String metricId;
  final double? uiScore;
  final Color accent;
  final bool onBlack;

  @override
  Widget build(BuildContext context) {
    final title = MetricPresentationPolicy.publicLabelAr(metricId);
    final status = MetricPresentationPolicy.faceExplorerStatusAr(uiScore);
    final scoreColor = onBlack
        ? SkinFaceMapVisualTokens.explorerOnBlack
        : AppColors.textPrimary;
    final statusColor = onBlack
        ? SkinFaceMapVisualTokens.explorerOnBlackMuted
        : AppColors.textSecondary;
    return Semantics(
      label: [
        title,
        if (uiScore != null) uiScore!.round().toString(),
        if (status.isNotEmpty) status,
      ].join(' '),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          children: [
            Text(
              title,
              style: AppTypography.titleSmall.copyWith(
                fontWeight: FontWeight.w800,
                color: accent,
              ),
              textAlign: TextAlign.center,
            ),
            if (uiScore != null) ...[
              const SizedBox(height: 2),
              Text(
                uiScore!.round().toString(),
                style: AppTypography.titleSmall.copyWith(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: scoreColor,
                  height: 1.05,
                ),
              ),
            ],
            if (status.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                status,
                style: AppTypography.labelSmall.copyWith(
                  color: statusColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.analysisCalloutSurface,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          fontWeight: FontWeight.w800,
          color: accent,
        ),
      ),
    );
  }
}

/// ONE RTL horizontal Beauty-Tech carousel — no «المزيد».
class _MetricCarousel extends StatelessWidget {
  const _MetricCarousel({
    required this.concerns,
    required this.selectedId,
    required this.onSelect,
    this.onBlack = false,
  });

  final List<ResultMapConcernVM> concerns;
  final String? selectedId;
  final ValueChanged<String> onSelect;
  final bool onBlack;

  @override
  Widget build(BuildContext context) {
    final idleFill = onBlack
        ? const Color(0xFF1A1A1D)
        : AppColors.background.withValues(alpha: 0.9);
    final idleBorder = onBlack
        ? const Color(0xFF2E2E33)
        : AppColors.border.withValues(alpha: 0.35);
    final idleLabel = onBlack
        ? SkinFaceMapVisualTokens.explorerOnBlackMuted
        : AppColors.textSecondary;
    final selectedLabel = onBlack
        ? SkinFaceMapVisualTokens.explorerOnBlack
        : AppColors.primaryDark;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Row(
          children: concerns.map((c) {
            final on = selectedId == c.id;
            final glyph = MiraSkinGlyphs.forConcern(c.id);
            final label = MetricPresentationPolicy.publicLabelAr(c.id);
            final accent = SkinFaceMapVisualTokens.accentForConcern(c.id);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Semantics(
                button: true,
                selected: on,
                label: label,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => onSelect(c.id),
                    child: AnimatedContainer(
                      duration: SkinFaceMapVisualTokens.selectionTransition,
                      constraints: const BoxConstraints(
                        minWidth: 76,
                        minHeight: 76,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: on ? accent.withValues(alpha: 0.32) : idleFill,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: on
                              ? accent.withValues(alpha: 0.85)
                              : idleBorder,
                          width: on ? 1.6 : 1,
                        ),
                        boxShadow: on
                            ? [
                                BoxShadow(
                                  color: accent.withValues(alpha: 0.22),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ]
                            : null,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          MiraSkinGlyphs.of(
                            glyph,
                            size: 22,
                            selected: on,
                            color: on ? accent : idleLabel,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            label,
                            style: AppTypography.labelSmall.copyWith(
                              fontWeight:
                                  on ? FontWeight.w800 : FontWeight.w600,
                              color: on ? selectedLabel : idleLabel,
                              height: 1.1,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
