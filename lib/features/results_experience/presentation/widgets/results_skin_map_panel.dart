import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/spacing.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../domain/face_map_overlay_decision.dart';
import '../../domain/face_map_session_evidence_exporter.dart';
import '../../domain/perfect_mask_session.dart';
import '../../domain/perfect_spatial_skin_concern_contract.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../../truth/skin_claim_policy.dart';
import '../../visibility/visibility_policy.dart';
import '../face_explorer/face_explorer_concern_catalog.dart';
import '../face_explorer/face_explorer_controller.dart';
import '../face_explorer/face_explorer_details.dart';
import '../face_explorer/face_explorer_image_loader.dart';
import '../face_explorer/face_explorer_lens_panel.dart';
import '../face_explorer/face_explorer_mask_presentation.dart';
import '../face_explorer/face_explorer_metrics.dart';
import '../face_explorer/face_explorer_stage.dart';
import '../geometry/skin_face_explorer_layer_isolation.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// Premium Interactive Skin Intelligence — ONE Face Explorer.
///
/// Orchestrates face_explorer modules; public API preserved for
/// [selectConcern] + external callbacks.
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
  late final FaceExplorerController _ctrl;
  late final FaceExplorerImageLoader _loader;
  final GlobalKey _exportButtonKey = GlobalKey(debugLabel: 'mapEvidenceExport');
  var _loggedUnavailable = false;
  Size? _stageViewportSize;

  List<ResultMapConcernVM> get _concerns => widget.map.concerns
      .where((c) => VisibilityPolicy.isPubliclyVisible(c.visibility))
      .toList();

  /// Analysis settled once a session is bound, history load finished, or stale.
  /// Missing primaries then show «غير متاح» instead of inventing scores.
  bool get _analysisSettled =>
      widget.fromHistory ||
      widget.isStale ||
      widget.maskSession != null ||
      widget.map.visibility == VisibilityState.unavailable;

  @override
  void initState() {
    super.initState();
    _ctrl = FaceExplorerController(initialSelectedId: widget.externalConcernId);
    _loader = FaceExplorerImageLoader(
      onChanged: () {
        if (mounted) setState(() {});
      },
      isMounted: () => mounted,
    );
    _loader.load(
      path: widget.ephemeralUserImagePath,
      fromHistory: widget.fromHistory,
      session: widget.maskSession,
    );
  }

  @override
  void dispose() {
    _loader.invalidate();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant ResultsSkinMapPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.externalConcernId != oldWidget.externalConcernId) {
      setState(() => _ctrl.applyExternalConcern(widget.externalConcernId));
    }
    if (widget.ephemeralUserImagePath != oldWidget.ephemeralUserImagePath ||
        widget.maskSession != oldWidget.maskSession ||
        widget.fromHistory != oldWidget.fromHistory) {
      _ctrl.applyExternalConcern(_ctrl.selectedId);
      _ctrl.holdingOriginal = false;
      _loader.load(
        path: widget.ephemeralUserImagePath,
        fromHistory: widget.fromHistory,
        session: widget.maskSession,
      );
    }
  }

  /// Public API used by [SkinInteractiveReportScreen].
  void selectConcern(String id) {
    HapticFeedback.selectionClick();
    final catalog = _concernCatalog();
    final available = [
      ...catalog.primary.map((s) => s.id),
      ...catalog.extras.map((s) => s.id),
    ];
    final next = nextSelectedMaskKey(
      previousKey: _ctrl.selectedId,
      nextKey: id,
      availableKeys: available,
    );
    final selected = next ?? id;
    setState(() => _ctrl.selectConcern(selected));
    if (_ctrl.selectedId == null) {
      widget.onConcernSelected(null);
    } else {
      widget.onConcernSelected(_ctrl.selectedId);
      _traceMaskRenderChain(_ctrl.selectedId!);
    }
  }

  void _selectSubregion(String region) {
    HapticFeedback.selectionClick();
    setState(() => _ctrl.selectSubregion(region));
  }

  void _traceMaskRenderChain(String metricId) {
    assert(() {
      final session = widget.maskSession;
      final provider = PerfectMaskSession.providerTypeForConsumerMetric(
        metricId,
      );
      final art = session?.lookup(consumerMetricId: metricId);
      final bytesLen = art?.bytes?.length ?? 0;
      debugPrint(
        'MASK_CHAIN tap=$metricId provider=$provider '
        'session=${session != null} bytes=$bytesLen',
      );
      return true;
    }());
  }

  FaceExplorerConcernCatalogResult _concernCatalog() {
    return FaceExplorerConcernCatalog.build(
      mapConcerns: _concerns,
      reportMetrics: widget.metrics,
      session: widget.maskSession,
      fromHistory: widget.fromHistory,
      analysisSettled: _analysisSettled,
    );
  }

  void _ensureAutoFocus({
    required PerfectMaskArtifact? mask,
    required String? selected,
  }) {
    if (selected == null ||
        mask?.bytes == null ||
        mask!.bytes!.isEmpty ||
        _ctrl.holdingOriginal) {
      return;
    }
    final profile = FaceExplorerMaskPresentation.profileForConcern(selected);
    final binding = _ctrl.focusBindingKey(
      mask: mask,
      profile: profile,
      sourceBytes: _loader.snapshot.sourceBytes,
    );
    if (_ctrl.magnifierBinder.shouldSkipAutoFor(binding)) return;
    if (_ctrl.autoFocusBindingKey == binding &&
        _ctrl.autoMagnifierSourceNorm != null) {
      return;
    }
    final focusAlign = PerfectMaskMagnifierFocus.fromMaskBytes(
      bytes: mask.bytes!,
      profile: profile,
    );
    if (focusAlign == null) return;
    final focus = Offset((focusAlign.x + 1) / 2, (focusAlign.y + 1) / 2);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_ctrl.magnifierBinder.shouldSkipAutoFor(binding)) return;
      setState(() {
        _ctrl.autoFocusBindingKey = binding;
        _ctrl.autoMagnifierSourceNorm = focus;
      });
    });
  }

  Future<void> _exportEvidenceZip() async {
    final session = widget.maskSession;
    if (session == null || _ctrl.exportBusy) return;
    setState(() => _ctrl.markExportBusy());
    final srcFp = FaceMapSessionEvidenceExporter.fingerprintBytes(
      _loader.snapshot.sourceBytes,
    );
    final attemptId =
        'MAP-$srcFp-${DateTime.now().toUtc().millisecondsSinceEpoch}';
    final result = await FaceMapSessionEvidenceExporter.buildAndShare(
      attemptId: attemptId,
      session: session,
      context: _exportButtonKey.currentContext ?? context,
      sourceBytes: _loader.snapshot.sourceBytes,
      sourceWidth: _loader.snapshot.sourceWidth,
      sourceHeight: _loader.snapshot.sourceHeight,
      selectedMetricId: _ctrl.selectedId,
      selectedSubregion: _ctrl.selectedSubregion,
      presentationSnapshot: {
        'magnifierZoom': _ctrl.magnifierZoom,
        'userFocus': _ctrl.magnifierBinder.hasUserFocus,
        'holdingOriginal': _ctrl.holdingOriginal,
        'lensPanelOpen': _ctrl.lensPanelOpen,
      },
    );
    if (!mounted) return;
    setState(() {
      if (result.ok) {
        _ctrl.markExportReady();
      } else {
        _ctrl.markExportFailed();
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

    final catalog = _concernCatalog();
    final selected = _ctrl.selectedId;
    final selectedSlot = selected == null ? null : catalog.byId(selected);
    const atmosphere = SkinFaceMapVisualTokens.explorerStage;

    if (widget.map.visibility == VisibilityState.unavailable &&
        catalog.readyIds.isEmpty) {
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

    FaceMapOverlayDecision? overlayDecision;
    PerfectMaskArtifact? activeMask;
    final allowOverlay =
        selected != null &&
        session != null &&
        selectedSlot?.status == FaceExplorerMetricSlotStatus.ready;
    if (allowOverlay) {
      overlayDecision = FaceMapOverlayDecision.resolve(
        selectedMetricId: selected,
        session: session,
        selectedSubregion: _ctrl.selectedSubregion,
        sourceWidth: _loader.snapshot.sourceWidth,
        sourceHeight: _loader.snapshot.sourceHeight,
        holdingOriginal: _ctrl.holdingOriginal,
        showPerfectMaskLayer: SkinFaceExplorerLayerIsolation.showPerfectMask,
      );
      activeMask = overlayDecision.boundArtifact;
      if (overlayDecision.showSpatialOverlay) {
        _ensureAutoFocus(mask: activeMask, selected: selected);
      }
    }

    final selectedRegion = _ctrl.selectedSubregion;
    final regionBound =
        selectedRegion == null ||
        selectedRegion == 'whole' ||
        selectedRegion == 'all' ||
        (activeMask != null && activeMask.region == selectedRegion);
    double? heroScore;
    if (selectedSlot?.status == FaceExplorerMetricSlotStatus.ready &&
        regionBound) {
      heroScore = activeMask?.uiScore ?? activeMask?.rawScore;
      if (heroScore == null && selected != null) {
        for (final m in widget.metrics) {
          final p = PerfectMaskSession.providerTypeForConsumerMetric(m.id);
          if (p != null && p == selectedSlot?.providerType) {
            heroScore = MetricPresentationPolicy.primaryScore(m)?.value;
            break;
          }
        }
      }
    }
    final accent = selected == null
        ? AppColors.primary
        : SkinFaceMapVisualTokens.accentForConcern(selected);
    final profile = FaceExplorerMaskPresentation.profileForConcern(selected);
    final showSpatialOverlay =
        overlayDecision?.showSpatialOverlay == true && !_ctrl.holdingOriginal;
    final remappedMaskBytes = showSpatialOverlay && activeMask != null
        ? session?.presentationBytesFor(artifact: activeMask, profile: profile)
        : null;
    final presentation = FaceExplorerMaskPresentation.resolve(
      profile: profile,
      showSpatialOverlay: showSpatialOverlay,
      remappedBytes: remappedMaskBytes,
      rawBytes: activeMask?.bytes,
    );
    final focusNorm = selected == null
        ? null
        : _ctrl.resolvedFocusSourceNorm(
            mask: activeMask,
            profile: profile,
            sourceBytes: _loader.snapshot.sourceBytes,
          );
    // Compare the analysis layers on the same photograph and background.
    final display = _loader.displayBytes(holdingOriginal: false);
    final snap = _loader.snapshot;

    return AnimatedContainer(
      key: widget.mapKey,
      duration: SkinFaceMapVisualTokens.metricCrossfade,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 16),
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
          FaceExplorerMetricsSection(
            catalog: catalog,
            selectedId: selected,
            showAll: _ctrl.showAllMetrics,
            onSelect: selectConcern,
            onToggleAll: () =>
                setState(() => _ctrl.showAllMetrics = !_ctrl.showAllMetrics),
          ),
          if (selected != null) ...[
            const SizedBox(height: 14),
            FaceExplorerReadingStrip(
              metricId: selected,
              uiScore: heroScore,
              accent: accent,
              scoreRegion: _ctrl.regionStrict
                  ? selectedRegion
                  : activeMask?.region,
              slotStatus: selectedSlot?.status,
            ),
          ],
          const SizedBox(height: 10),
          if (snap.matteLoading)
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
          else if (snap.matteError != null && snap.faceOnlyBlackBytes == null)
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
          if (widget.missingImage || display == null || display.isEmpty)
            Semantics(
              label: 'صورة الوجه غير متاحة',
              child: Container(
                height: 280,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: SkinFaceMapVisualTokens.explorerStage,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Text(
                  widget.fromHistory
                      ? 'الصورة غير متاحة من السجل.'
                      : 'صورة الوجه غير متاحة لهذه الجلسة.',
                  style: AppTypography.bodySmall.copyWith(
                    color: SkinFaceMapVisualTokens.explorerOnStageMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else if (overlayDecision != null || selected == null)
            FaceExplorerStage(
              displayBytes: display,
              sourceWidth: snap.sourceWidth,
              sourceHeight: snap.sourceHeight,
              presentation: presentation,
              selectedId: selected,
              decision:
                  overlayDecision ??
                  FaceMapOverlayDecision.resolve(
                    selectedMetricId: null,
                    session: session,
                    selectedSubregion: null,
                    sourceWidth: snap.sourceWidth,
                    sourceHeight: snap.sourceHeight,
                    holdingOriginal: true,
                    showPerfectMaskLayer: false,
                  ),
              holdingOriginal: _ctrl.holdingOriginal,
              lensPanelOpen: _ctrl.lensPanelOpen,
              focusSourceNorm: focusNorm,
              onViewportChanged: (size) {
                if (mounted && _stageViewportSize != size) {
                  setState(() => _stageViewportSize = size);
                }
              },
              onOpenLens: () => setState(() => _ctrl.lensPanelOpen = true),
              onTapSourceNorm: (norm) {
                final mask = _ctrl.boundMask(session);
                setState(() {
                  _ctrl.setUserFocusFromNorm(
                    sourceNorm01: norm,
                    mask: mask,
                    profile: profile,
                    sourceBytes: snap.sourceBytes,
                  );
                });
              },
            ),
          if (selected != null) ...[
            const SizedBox(height: 10),
            FaceExplorerActionRow(
              holdingOriginal: _ctrl.holdingOriginal,
              lensPanelOpen: _ctrl.lensPanelOpen,
              onCompareDown: () {
                HapticFeedback.lightImpact();
                setState(() => _ctrl.holdingOriginal = true);
              },
              onCompareUp: () => setState(() => _ctrl.holdingOriginal = false),
              onToggleLens: () => setState(() {
                _ctrl.lensPanelOpen = !_ctrl.lensPanelOpen;
                if (_ctrl.lensPanelOpen && focusNorm == null) {
                  _ctrl.setFocusFromSliders(
                    nx: 0.5,
                    ny: 0.45,
                    session: session,
                    sourceBytes: snap.sourceBytes,
                  );
                }
              }),
            ),
            if (_ctrl.lensPanelOpen) ...[
              const SizedBox(height: 12),
              FaceExplorerLensPanel(
                sourceBytes: display,
                presentation: presentation,
                tint: accent.withValues(alpha: profile.tintAlpha),
                focusSourceNorm: focusNorm ?? const Offset(0.5, 0.45),
                zoom: _ctrl.magnifierZoom,
                stageViewport: _stageViewportSize,
                sourceWidth: snap.sourceWidth,
                sourceHeight: snap.sourceHeight,
                onToggleZoom: () => setState(() {
                  _ctrl.magnifierZoom = _ctrl.magnifierZoom == 2.0 ? 3.0 : 2.0;
                }),
                onHorizontal: (v) => setState(() {
                  _ctrl.setFocusFromSliders(
                    nx: v,
                    session: session,
                    sourceBytes: snap.sourceBytes,
                  );
                }),
                onVertical: (v) => setState(() {
                  _ctrl.setFocusFromSliders(
                    ny: v,
                    session: session,
                    sourceBytes: snap.sourceBytes,
                  );
                }),
              ),
            ],
            const SizedBox(height: 12),
            FaceExplorerFocusShortcutsRow(
              activeId: _ctrl.focusShortcutId,
              onSelect: (s) {
                HapticFeedback.selectionClick();
                setState(() {
                  _ctrl.applyFocusShortcut(
                    shortcut: s,
                    session: session,
                    sourceBytes: snap.sourceBytes,
                  );
                });
              },
            ),
            const SizedBox(height: 8),
            FaceExplorerDetailsSection(
              selectedId: selected,
              overlayDecision: overlayDecision,
              holdingOriginal: _ctrl.holdingOriginal,
              session: session,
              selectedSubregion: _ctrl.selectedSubregion,
              showSubregionDetails: _ctrl.showSubregionDetails,
              onToggleSubregions: () => setState(
                () => _ctrl.showSubregionDetails = !_ctrl.showSubregionDetails,
              ),
              onSelectSubregion: _selectSubregion,
            ),
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
          if (FaceMapSessionEvidenceExporter.inspectionExportEnabled &&
              session != null &&
              !widget.fromHistory) ...[
            const SizedBox(height: AppSpacing.md),
            Center(
              child: TextButton.icon(
                key: _exportButtonKey,
                onPressed: _ctrl.exportBusy ? null : _exportEvidenceZip,
                icon: _ctrl.exportBusy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share, size: 18),
                label: Text(
                  _ctrl.exportBusy
                      ? 'جاري التجهيز…'
                      : _ctrl.exportFailed
                      ? 'إعادة المحاولة'
                      : 'تصدير أدلة الفحص',
                  style: AppTypography.labelMedium.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                  minimumSize: const Size(48, 44),
                ),
              ),
            ),
            if (_ctrl.exportStatusMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  _ctrl.exportStatusMessage!,
                  style: AppTypography.labelSmall.copyWith(
                    color: _ctrl.exportFailed
                        ? AppColors.warning
                        : SkinFaceMapVisualTokens.explorerOnBlackMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ],
      ),
    );
  }
}
