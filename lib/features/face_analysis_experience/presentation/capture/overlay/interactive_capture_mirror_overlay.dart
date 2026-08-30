import 'package:flutter/material.dart';

import '../../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../../capture/contracts/face_capture_guidance_vm.dart';
import '../../../capture/contracts/face_capture_semantic.dart';
import '../contour/capture_contour_reducer.dart';
import '../contour/capture_mirror_painter.dart';
import '../feedback/capture_flash_layer.dart';
import '../guidance/capture_mirror_guidance_bar.dart';

/// Interactive Capture Mirror visual surface — consumes 9B [FaceCaptureGuidanceVm].
class InteractiveCaptureMirrorOverlay extends StatefulWidget {
  final FaceMeshFrame frame;
  final FaceCaptureGuidanceVm guidance;
  final PoseKind poseHint;
  final double holdProgress01;
  final double pulse;
  final double flashOpacity;
  final bool reduceMotion;
  final bool showGuidance;

  const InteractiveCaptureMirrorOverlay({
    super.key,
    required this.frame,
    required this.guidance,
    required this.poseHint,
    required this.holdProgress01,
    required this.pulse,
    this.flashOpacity = 0,
    this.reduceMotion = false,
    this.showGuidance = true,
  });

  @override
  State<InteractiveCaptureMirrorOverlay> createState() =>
      _InteractiveCaptureMirrorOverlayState();
}

class _InteractiveCaptureMirrorOverlayState
    extends State<InteractiveCaptureMirrorOverlay> {
  List<Offset> _smoothed = const [];

  @override
  void didUpdateWidget(covariant InteractiveCaptureMirrorOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = CaptureContourReducer.reduceOutline(widget.frame.outline);
    if (widget.reduceMotion) {
      _smoothed = next;
      return;
    }
    if (_smoothed.isEmpty || _smoothed.length != next.length) {
      _smoothed = next;
    } else {
      _smoothed = CaptureContourReducer.lerpAnchors(_smoothed, next, 0.42);
    }
  }

  @override
  Widget build(BuildContext context) {
    final locked = widget.guidance.state == FaceCaptureReadinessState.captureInProgress ||
        widget.guidance.state == FaceCaptureReadinessState.captured;

    return Stack(
      fit: StackFit.expand,
      children: [
        RepaintBoundary(
          child: CustomPaint(
            painter: CaptureMirrorPainter(
              contourAnchors: _smoothed.isNotEmpty
                  ? _smoothed
                  : CaptureContourReducer.reduceOutline(widget.frame.outline),
              state: widget.guidance.state,
              isReady: widget.guidance.isReady,
              holdProgress01: widget.holdProgress01,
              pulse: widget.reduceMotion ? 0 : widget.pulse,
              reduceMotion: widget.reduceMotion,
              poseHint: widget.poseHint,
            ),
          ),
        ),
        if (widget.showGuidance)
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              minimum: const EdgeInsets.only(bottom: 12),
              child: CaptureMirrorGuidanceBar(
                guidance: widget.guidance,
                locked: locked,
              ),
            ),
          ),
        CaptureFlashLayer(opacity: widget.flashOpacity),
      ],
    );
  }
}
