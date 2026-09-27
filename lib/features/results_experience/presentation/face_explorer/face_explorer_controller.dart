import 'dart:typed_data';
import 'dart:ui' show Offset;

import '../../domain/face_map_session_evidence_exporter.dart';
import '../../domain/perfect_mask_session.dart';
import '../geometry/magnifier_focus_binder.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// Explicit inspection-export UI state — never parse Arabic strings.
enum FaceExplorerExportUiStatus { idle, busy, ready, failed }

/// Focus shortcut for lens position only — not a provider measurement region.
class FaceExplorerFocusShortcut {
  const FaceExplorerFocusShortcut({
    required this.id,
    required this.labelAr,
    required this.sourceNorm,
  });

  final String id;
  final String labelAr;
  final Offset sourceNorm;
}

/// Selection / lens / compare / export coordination for Face Explorer.
///
/// Does **not** own image bytes (see [FaceExplorerImageLoader]) or build
/// widgets — keeps dependency layers thin.
class FaceExplorerController {
  FaceExplorerController({String? initialSelectedId})
    : selectedId = initialSelectedId;

  String? selectedId;
  String? selectedSubregion;
  var showSubregionDetails = false;
  var showAllMetrics = false;
  var holdingOriginal = false;
  var lensPanelOpen = false;
  String? focusShortcutId;
  var magnifierZoom = 2.0;
  var exportStatus = FaceExplorerExportUiStatus.idle;
  String? exportStatusMessage;

  final MagnifierFocusBinder magnifierBinder = MagnifierFocusBinder();
  Offset? autoMagnifierSourceNorm;
  String? autoFocusBindingKey;

  static const primaryConsumerIds = <String>[
    'pores',
    'wrinkles',
    'acne',
    'pigmentation',
    'hydration',
    'oiliness',
  ];

  static const focusShortcuts = <FaceExplorerFocusShortcut>[
    FaceExplorerFocusShortcut(
      id: 'forehead',
      labelAr: 'الجبهة',
      sourceNorm: Offset(0.50, 0.17),
    ),
    FaceExplorerFocusShortcut(
      id: 'nose',
      labelAr: 'الأنف',
      sourceNorm: Offset(0.51, 0.58),
    ),
    FaceExplorerFocusShortcut(
      id: 'cheek',
      labelAr: 'الخد',
      sourceNorm: Offset(0.76, 0.60),
    ),
  ];

  bool get regionStrict =>
      selectedSubregion != null &&
      selectedSubregion != 'whole' &&
      selectedSubregion != 'all';

  /// Same mask binding for tap / sliders / shortcuts / overlay decision.
  PerfectMaskArtifact? boundMask(
    PerfectMaskSession? session, {
    String? metricId,
  }) {
    final id = metricId ?? selectedId;
    if (session == null || id == null) return null;
    return session.lookup(
      consumerMetricId: id,
      subregion: selectedSubregion,
      requireExactRegion: regionStrict,
    );
  }

  String focusBindingKey({
    required PerfectMaskArtifact? mask,
    required PerfectMaskPresentationProfile profile,
    required Uint8List? sourceBytes,
  }) {
    final srcFp = FaceMapSessionEvidenceExporter.fingerprintBytes(sourceBytes);
    return '${mask?.key ?? "none"}|${selectedSubregion ?? "whole"}|'
        '${profile.alphaMode.name}|$srcFp';
  }

  Offset? resolvedFocusSourceNorm({
    required PerfectMaskArtifact? mask,
    required PerfectMaskPresentationProfile profile,
    required Uint8List? sourceBytes,
  }) {
    final binding = focusBindingKey(
      mask: mask,
      profile: profile,
      sourceBytes: sourceBytes,
    );
    return magnifierBinder.resolve(
      bindingKey: binding,
      autoSourceNorm: (autoFocusBindingKey == binding)
          ? autoMagnifierSourceNorm
          : null,
    );
  }

  void clearFocusState() {
    magnifierBinder.clearUserFocus();
    autoMagnifierSourceNorm = null;
    autoFocusBindingKey = null;
    lensPanelOpen = false;
    focusShortcutId = null;
  }

  void applyExternalConcern(String? id) {
    selectedId = id;
    selectedSubregion = null;
    showSubregionDetails = false;
    clearFocusState();
  }

  void selectConcern(String id) {
    if (selectedId == id) {
      clearToOriginal();
      return;
    }
    selectedId = id;
    selectedSubregion = null;
    showSubregionDetails = false;
    holdingOriginal = false;
    clearFocusState();
  }

  void clearToOriginal() {
    selectedId = null;
    selectedSubregion = null;
    showSubregionDetails = false;
    holdingOriginal = false;
    clearFocusState();
  }

  void selectSubregion(String region) {
    selectedSubregion = region;
    clearFocusState();
  }

  void setUserFocusFromNorm({
    required Offset sourceNorm01,
    required PerfectMaskArtifact? mask,
    required PerfectMaskPresentationProfile profile,
    required Uint8List? sourceBytes,
    String? shortcutId,
    bool openLens = true,
  }) {
    final binding = focusBindingKey(
      mask: mask,
      profile: profile,
      sourceBytes: sourceBytes,
    );
    magnifierBinder.setUserFocus(
      sourceNorm01: sourceNorm01,
      bindingKey: binding,
    );
    focusShortcutId = shortcutId;
    if (openLens) lensPanelOpen = true;
  }

  void setFocusFromSliders({
    double? nx,
    double? ny,
    required PerfectMaskSession? session,
    required Uint8List? sourceBytes,
  }) {
    final id = selectedId;
    if (id == null || session == null) return;
    final mask = boundMask(session);
    final profile = SkinFaceMapVisualTokens.presentationProfileForConcern(id);
    final current =
        resolvedFocusSourceNorm(
          mask: mask,
          profile: profile,
          sourceBytes: sourceBytes,
        ) ??
        const Offset(0.5, 0.5);
    final next = Offset(
      (nx ?? current.dx).clamp(0.05, 0.95),
      (ny ?? current.dy).clamp(0.05, 0.95),
    );
    setUserFocusFromNorm(
      sourceNorm01: next,
      mask: mask,
      profile: profile,
      sourceBytes: sourceBytes,
      shortcutId: null,
      openLens: true,
    );
  }

  void applyFocusShortcut({
    required FaceExplorerFocusShortcut shortcut,
    required PerfectMaskSession? session,
    required Uint8List? sourceBytes,
  }) {
    final id = selectedId;
    if (id == null || session == null) return;
    final mask = boundMask(session);
    final profile = SkinFaceMapVisualTokens.presentationProfileForConcern(id);
    setUserFocusFromNorm(
      sourceNorm01: shortcut.sourceNorm,
      mask: mask,
      profile: profile,
      sourceBytes: sourceBytes,
      shortcutId: shortcut.id,
      openLens: true,
    );
  }

  void markExportBusy() {
    exportStatus = FaceExplorerExportUiStatus.busy;
    exportStatusMessage = 'جاري التجهيز…';
  }

  void markExportReady() {
    exportStatus = FaceExplorerExportUiStatus.ready;
    exportStatusMessage = 'جاهز للمشاركة — اختاري AirDrop أو Files';
  }

  void markExportFailed() {
    exportStatus = FaceExplorerExportUiStatus.failed;
    exportStatusMessage = 'تعذر المشاركة — أعيدي المحاولة';
  }

  bool get exportBusy => exportStatus == FaceExplorerExportUiStatus.busy;
  bool get exportFailed => exportStatus == FaceExplorerExportUiStatus.failed;
}
