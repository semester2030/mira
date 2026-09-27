import 'dart:ui';

import '../../../../core/face_gate/face_gate_result.dart';
import '../../../face_analysis_experience/capture/contracts/face_capture_guidance_vm.dart';
import '../../../face_analysis_experience/capture/contracts/face_capture_readiness_result.dart';
import '../../../face_analysis_experience/presentation/capture/geometry/capture_guide_geometry.dart';
import '../live_face_map/face_mesh_quality_gate.dart';
import '../live_face_map/models/face_mesh_models.dart';
import '../live_face_map/utils/cheek_midline_crossing.dart';
import '../live_face_map/utils/region_path_utils.dart';
import 'skin_capture_tap_gate.dart';

/// One live gate row for the debug HUD — values only, no threshold changes.
class SkinCaptureGateRow {
  final String id;
  final String label;
  final String actual;
  final String required;
  final bool pass;
  final bool available;

  const SkinCaptureGateRow({
    required this.id,
    required this.label,
    required this.actual,
    required this.required,
    required this.pass,
    this.available = true,
  });
}

/// Frozen diagnostic of the CURRENT Skin capture authorization equation.
class SkinCaptureGateSnapshot {
  final bool mirrorEnabled;
  final bool cameraReady;
  final bool captureInProgress;
  final bool canonicalReady;
  final String? meshGateReason;
  final List<SkinCaptureGateRow> rows;
  final List<String> blockingGateIds;

  const SkinCaptureGateSnapshot({
    required this.mirrorEnabled,
    required this.cameraReady,
    required this.captureInProgress,
    required this.canonicalReady,
    required this.meshGateReason,
    required this.rows,
    required this.blockingGateIds,
  });

  /// Exact production equation (documented + evaluated):
  ///
  /// ```
  /// cameraReady
  /// && SkinCaptureTapGate.isCaptureReady(
  ///      mirrorEnabled,
  ///      guidance,
  ///      FaceMeshQualityGate.evaluate(frame, guide),
  ///      frame,
  ///    )
  /// ```
  ///
  /// FaceMeshQualityGate.evaluate requires ALL of:
  /// hasFace, quality!=low, regions{forehead,underEye,nose,LEFT+RIGHT cheek,chin},
  /// bounds, |centerX|<=0.11, |centerY|<=0.10, heightRatio∈[0.74,1.06],
  /// |yaw|<=15°, |pitch|<=15°, |roll|<=12° (live MediaPipe 3D pose).
  ///
  /// Then:
  /// - Mirror ON  → also guidance.isReady
  /// - Mirror OFF → also canTakePhoto (hasFace && quality!=low)
  ///
  /// centerY equation (guide-relative drift, NOT absolute Y):
  ///   (boundingBox.center.dy - guide.center.dy) / guide.height
  /// guide centerY = viewport.height * 0.48
  static SkinCaptureGateSnapshot fromLive({
    required bool mirrorEnabled,
    required bool cameraReady,
    required bool captureInProgress,
    required Size viewport,
    required FaceMeshFrame frame,
    required FaceCaptureGuidanceVm? guidance,
    FaceCaptureReadinessResult? mirrorResult,
    /// Exact painted authorize flag from the panel (single source).
    bool? buttonCaptureReady,
    bool? sessionInteractive,
    bool? initializing,
    bool? hasError,
    bool? widgetEnabled,
    bool? analyzing,
    bool? validating,
  }) {
    final guide = CaptureGuideGeometry.illustrativeOval(viewport);
    final meshGate = viewport == Size.zero
        ? const FaceGateResult.rejected(
            reasonCode: 'mesh_not_ready',
            messageAr: 'جاري تجهيز الإطار.',
          )
        : FaceMeshQualityGate.evaluate(frame, guide);

    final metrics = CaptureGuideGeometry.meshMetrics(
      boundingBox: frame.boundingBox,
      viewport: viewport,
    );
    final centerX = metrics.$1;
    final centerY = metrics.$2;
    final scale = metrics.$3;
    final box = frame.boundingBox;
    final absNormY = box == null || viewport.height <= 0
        ? null
        : box.center.dy / viewport.height;
    final boxCy = box?.center.dy;
    final guideCy = guide.center.dy;

    bool regionOk(FaceRegionId id) => frame.regions.any(
          (r) => r.id == id && r.points.length >= 3 && !r.suppressed,
        );

    final foreheadOk = regionOk(FaceRegionId.forehead);
    final underEyeOk = regionOk(FaceRegionId.underEye);
    final noseOk = regionOk(FaceRegionId.nose);
    final cheekOk = regionOk(FaceRegionId.cheek);
    final chinOk = regionOk(FaceRegionId.chin);
    FaceRegionPolygon? leftCheekRegion;
    FaceRegionPolygon? rightCheekRegion;
    for (final r in frame.regions) {
      if (r.id != FaceRegionId.cheek) continue;
      if (r.isLeftSide) {
        leftCheekRegion ??= r;
      } else {
        rightCheekRegion ??= r;
      }
    }
    final leftCheekOk = leftCheekRegion != null &&
        leftCheekRegion.points.length >= 3 &&
        !leftCheekRegion.suppressed;
    final rightCheekOk = rightCheekRegion != null &&
        rightCheekRegion.points.length >= 3 &&
        !rightCheekRegion.suppressed;

    String cheekDetail(FaceRegionPolygon? r, {required bool isLeft}) {
      if (r == null) return 'missing';
      if (r.points.length < 3) return 'pts<3';
      final midX = frame.anatomicalMidlineX;
      if (midX != null) {
        final report = CheekMidlineCrossing.evaluate(
          cheekPoints: r.points,
          isAnatomicalLeft: isLeft,
          midlineX: midX,
          anatomicalLeftIsLowerX: frame.anatomicalLeftIsLowerX,
        );
        final tag = report.crossedMidline ? 'FAIL' : 'PASS';
        return '$tag ${report.correctSideCount}/${report.pointCount}'
            ' r=${report.correctSideRatio.toStringAsFixed(2)}';
      }
      if (!r.suppressed) return 'YES n=${r.points.length}';
      final reason = RegionPathUtils.suppressReason(
        id: FaceRegionId.cheek,
        points: r.points,
        faceOval: frame.outline,
        isLeftSide: isLeft,
        viewportSize: viewport,
        anatomicalMidlineX: _midlineFromFrame(frame),
        anatomicalLeftIsLowerX: frame.anatomicalLeftIsLowerX,
      );
      return 'SUP:${reason ?? "?"} n=${r.points.length}';
    }

    final faceCount = frame.hasFace ? 1 : 0;
    final qualityOk = frame.quality != FaceTrackingQuality.low;
    final centerXOk = centerX != null &&
        centerX.abs() <= FaceMeshQualityGate.maxCenterDriftX;
    final centerYOk = centerY != null &&
        centerY.abs() <= FaceMeshQualityGate.maxCenterDriftY;
    final scaleOk = scale != null &&
        scale >= FaceMeshQualityGate.minFaceHeightRatio &&
        scale <= FaceMeshQualityGate.maxFaceHeightRatio;

    final yaw = frame.yawDegrees;
    final pitch = frame.pitchDegrees;
    final roll = frame.rollDegrees;
    final yawOk =
        yaw != null && yaw.abs() <= FaceMeshQualityGate.maxYawDegrees;
    final pitchOk =
        pitch != null && pitch.abs() <= FaceMeshQualityGate.maxPitchDegrees;
    final rollOk =
        roll != null && roll.abs() <= FaceMeshQualityGate.maxRollDegrees;

    final mirrorReady = guidance?.isReady == true;
    final canTake = FaceMeshQualityGate.canTakePhoto(frame);

    final meshCanonical = cameraReady &&
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: mirrorEnabled,
          guidance: guidance,
          liveMeshGate: meshGate,
          frame: frame,
        );
    // Prefer the exact painted authorize flag from the panel (no independent HUD logic).
    final canonical = buttonCaptureReady ?? meshCanonical;

    String fmt(double? v, {int digits = 3}) =>
        v == null ? 'N/A' : v.toStringAsFixed(digits);

    final rows = <SkinCaptureGateRow>[
      if (widgetEnabled != null)
        SkinCaptureGateRow(
          id: 'widgetEnabled',
          label: 'SESSION ENABLED',
          actual: widgetEnabled ? 'YES' : 'NO',
          required: 'YES',
          pass: widgetEnabled,
        ),
      if (analyzing != null)
        SkinCaptureGateRow(
          id: 'analyzing',
          label: 'NOT ANALYZING',
          actual: analyzing ? 'NO' : 'YES',
          required: 'YES',
          pass: !analyzing,
        ),
      if (validating != null)
        SkinCaptureGateRow(
          id: 'validating',
          label: 'NOT VALIDATING',
          actual: validating ? 'NO' : 'YES',
          required: 'YES',
          pass: !validating,
        ),
      if (initializing != null)
        SkinCaptureGateRow(
          id: 'initializing',
          label: 'NOT INIT',
          actual: initializing ? 'NO' : 'YES',
          required: 'YES',
          pass: !initializing,
        ),
      if (hasError != null)
        SkinCaptureGateRow(
          id: 'hasError',
          label: 'NO ERROR',
          actual: hasError ? 'NO' : 'YES',
          required: 'YES',
          pass: !hasError,
        ),
      if (sessionInteractive != null)
        SkinCaptureGateRow(
          id: 'sessionInteractive',
          label: 'SESSION READY',
          actual: sessionInteractive ? 'YES' : 'NO',
          required: 'YES',
          pass: sessionInteractive,
        ),
      SkinCaptureGateRow(
        id: 'cameraReady',
        label: 'CAMERA READY',
        actual: cameraReady ? 'YES' : 'NO',
        required: 'YES',
        pass: cameraReady,
      ),
      SkinCaptureGateRow(
        id: 'captureInProgress',
        label: 'CAPTURE BUSY',
        actual: captureInProgress ? 'YES' : 'NO',
        required: 'NO',
        pass: !captureInProgress,
      ),
      if (buttonCaptureReady != null)
        SkinCaptureGateRow(
          id: 'buttonCaptureReady',
          label: 'BUTTON CAPTURE',
          actual: buttonCaptureReady ? 'YES' : 'NO',
          required: 'YES (= READY)',
          pass: buttonCaptureReady,
        ),
      SkinCaptureGateRow(
        id: 'faceCount',
        label: 'FACE COUNT',
        actual: '$faceCount',
        required: '1',
        pass: faceCount == 1,
      ),
      SkinCaptureGateRow(
        id: 'landmarkQuality',
        label: 'LANDMARK QUALITY',
        actual: frame.quality.name,
        required: '!= low',
        pass: qualityOk,
      ),
      SkinCaptureGateRow(
        id: 'centerX',
        label: 'CENTER X',
        actual: fmt(centerX),
        required: '|x|<=${FaceMeshQualityGate.maxCenterDriftX}',
        pass: centerXOk,
        available: centerX != null,
      ),
      SkinCaptureGateRow(
        id: 'centerY',
        label: 'CENTER Y DRIFT',
        actual: fmt(centerY),
        required: '|y|<=${FaceMeshQualityGate.maxCenterDriftY}',
        pass: centerYOk,
        available: centerY != null,
      ),
      SkinCaptureGateRow(
        id: 'centerYDiag',
        label: 'CY box/guide/abs',
        actual:
            '${fmt(boxCy, digits: 0)}/${fmt(guideCy, digits: 0)}/${fmt(absNormY)}',
        required: 'diag only',
        pass: true,
        available: box != null,
      ),
      SkinCaptureGateRow(
        id: 'faceScale',
        label: 'FACE SCALE',
        actual: fmt(scale),
        required:
            '${FaceMeshQualityGate.minFaceHeightRatio}..${FaceMeshQualityGate.maxFaceHeightRatio}',
        pass: scaleOk,
        available: scale != null,
      ),
      SkinCaptureGateRow(
        id: 'yaw',
        label: 'YAW',
        actual: yaw == null ? 'N/A' : '${yaw.toStringAsFixed(1)}°',
        required: '|y|<=${FaceMeshQualityGate.maxYawDegrees}',
        pass: yawOk,
        available: yaw != null,
      ),
      SkinCaptureGateRow(
        id: 'pitch',
        label: 'PITCH',
        actual: pitch == null ? 'N/A' : '${pitch.toStringAsFixed(1)}°',
        required: '|p|<=${FaceMeshQualityGate.maxPitchDegrees}',
        pass: pitchOk,
        available: pitch != null,
      ),
      SkinCaptureGateRow(
        id: 'roll',
        label: 'ROLL',
        actual: roll == null ? 'N/A' : '${roll.toStringAsFixed(1)}°',
        required: '|r|<=${FaceMeshQualityGate.maxRollDegrees}',
        pass: rollOk,
        available: roll != null,
      ),
      SkinCaptureGateRow(
        id: 'forehead',
        label: 'FOREHEAD REGION',
        actual: foreheadOk ? 'YES' : 'NO',
        required: 'valid polygon',
        pass: foreheadOk,
      ),
      SkinCaptureGateRow(
        id: 'underEye',
        label: 'UNDER-EYE REGION',
        actual: underEyeOk ? 'YES' : 'NO',
        required: 'valid polygon',
        pass: underEyeOk,
      ),
      SkinCaptureGateRow(
        id: 'nose',
        label: 'NOSE REGION',
        actual: noseOk ? 'YES' : 'NO',
        required: 'valid polygon',
        pass: noseOk,
      ),
      SkinCaptureGateRow(
        id: 'cheekAny',
        label: 'CHEEK REGION (any)',
        actual: cheekOk ? 'YES' : 'NO',
        required: 'valid polygon',
        pass: cheekOk,
      ),
      SkinCaptureGateRow(
        id: 'leftCheek',
        label: 'LEFT CHEEK',
        actual: cheekDetail(leftCheekRegion, isLeft: true),
        required: 'anatomical L !suppressed',
        pass: leftCheekOk,
      ),
      SkinCaptureGateRow(
        id: 'rightCheek',
        label: 'RIGHT CHEEK',
        actual: cheekDetail(rightCheekRegion, isLeft: false),
        required: 'anatomical R !suppressed',
        pass: rightCheekOk,
      ),
      SkinCaptureGateRow(
        id: 'chin',
        label: 'CHIN REGION',
        actual: chinOk ? 'YES' : 'NO',
        required: 'valid polygon',
        pass: chinOk,
      ),
      SkinCaptureGateRow(
        id: 'meshGate',
        label: 'MESH GATE',
        actual: meshGate.isAccepted
            ? 'PASS'
            : (meshGate.reasonCode ?? 'FAIL'),
        required: 'accepted',
        pass: meshGate.isAccepted,
      ),
      SkinCaptureGateRow(
        id: 'mirrorEnabled',
        label: 'MIRROR FLAG',
        actual: mirrorEnabled ? 'ON' : 'OFF',
        required: 'runtime flag',
        pass: true,
      ),
      SkinCaptureGateRow(
        id: 'mirrorIsReady',
        label: 'MIRROR isReady',
        actual: mirrorEnabled
            ? (mirrorReady ? 'YES' : 'NO')
            : 'N/A (flag off)',
        required: mirrorEnabled ? 'YES' : 'N/A',
        pass: !mirrorEnabled || mirrorReady,
        available: mirrorEnabled,
      ),
      SkinCaptureGateRow(
        id: 'canTakePhoto',
        label: 'canTakePhoto',
        actual: canTake ? 'YES' : 'NO',
        required: mirrorEnabled ? 'N/A' : 'YES',
        pass: mirrorEnabled || canTake,
      ),
      if (mirrorResult != null)
        SkinCaptureGateRow(
          id: 'mirrorState',
          label: 'MIRROR STATE',
          actual: '${mirrorResult.state.name}/${mirrorResult.reasonCode}',
          required: 'ready',
          pass: mirrorResult.isReady,
          available: mirrorEnabled,
        ),
    ];

    final blocking = <String>[
      for (final r in rows)
        if (r.available &&
            !r.pass &&
            r.id != 'centerYDiag' &&
            r.id != 'cheekAny')
          r.id,
    ];

    return SkinCaptureGateSnapshot(
      mirrorEnabled: mirrorEnabled,
      cameraReady: cameraReady,
      captureInProgress: captureInProgress,
      canonicalReady: canonical,
      meshGateReason: meshGate.reasonCode,
      rows: rows,
      blockingGateIds: blocking,
    );
  }

  /// Best-effort anatomical midline for HUD re-check of suppressed cheeks.
  static double? _midlineFromFrame(FaceMeshFrame frame) {
    final nose = frame.regions.where(
      (r) => r.id == FaceRegionId.nose && r.points.length >= 3,
    );
    if (nose.isEmpty) return null;
    final pts = nose.first.points;
    return pts.map((p) => p.x).reduce((a, b) => a + b) / pts.length;
  }
}
