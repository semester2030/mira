import 'dart:io';

import 'package:flutter/material.dart';

import '../../../projection/contracts/face_result_enums.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../shared/face_experience_tokens.dart';
import '../overlays/face_region_interaction_layer.dart';
import '../overlays/face_result_overlay.dart';
import '../tokens/face_result_tokens.dart';

/// Face-dominant mirror surface — image + illustrative overlay + region hits.
class FaceResultMirrorSurface extends StatefulWidget {
  const FaceResultMirrorSurface({
    super.key,
    required this.imagePath,
    required this.orientation,
    required this.contourAllowed,
    required this.contourCalm,
    required this.interactiveRegionsAllowed,
    required this.regions,
    required this.selectedRegion,
    required this.onRegionTap,
  });

  final String? imagePath;
  final FaceSubjectOrientation orientation;
  final bool contourAllowed;
  final bool contourCalm;
  final bool interactiveRegionsAllowed;
  final List<FaceRegionAssociationVm> regions;
  final FacePresentationRegion? selectedRegion;
  final ValueChanged<FacePresentationRegion> onRegionTap;

  /// Safe face framing inset — region overlays attach to this box across BoxFit.cover.
  static Rect faceBoxFor(Size size) {
    final padX = size.width * 0.08;
    final padY = size.height * 0.06;
    return Rect.fromLTRB(padX, padY, size.width - padX, size.height - padY);
  }

  @override
  State<FaceResultMirrorSurface> createState() =>
      _FaceResultMirrorSurfaceState();
}

class _FaceResultMirrorSurfaceState extends State<FaceResultMirrorSurface> {
  bool? _fileExists;
  String? _checkedPath;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ensureFileCheck();
  }

  @override
  void didUpdateWidget(covariant FaceResultMirrorSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imagePath != widget.imagePath) {
      _fileExists = null;
      _checkedPath = null;
      _ensureFileCheck();
    }
  }

  void _ensureFileCheck() {
    final path = widget.imagePath;
    if (path == null) {
      _fileExists = false;
      _checkedPath = null;
      return;
    }
    if (_checkedPath == path && _fileExists != null) return;
    _checkedPath = path;
    // One sync check per path — avoid existsSync on every rebuild (9K).
    _fileExists = File(path).existsSync();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        final faceBox = FaceResultMirrorSurface.faceBoxFor(size);

        final mirrorPreview =
            widget.orientation == FaceSubjectOrientation.mirroredPreview;

        return ClipRRect(
          borderRadius:
              BorderRadius.circular(FaceExperienceTokens.mirrorRadius),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: FaceResultTokens.dimMask),
              if (widget.imagePath != null && _fileExists == true)
                Positioned.fill(
                  child: Transform.flip(
                    flipX: mirrorPreview,
                    child: Image.file(
                      File(widget.imagePath!),
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                      filterQuality: FilterQuality.medium,
                    ),
                  ),
                )
              else
                Center(
                  child: Icon(
                    Icons.person_outline,
                    size: 72,
                    color: FaceResultTokens.pearl.withValues(alpha: 0.35),
                  ),
                ),
              CustomPaint(
                painter: FaceResultOverlayPainter(
                  faceBox: faceBox,
                  contourAllowed: widget.contourAllowed,
                  contourCalm: widget.contourCalm,
                  selectedRegion: widget.selectedRegion,
                ),
              ),
              FaceRegionInteractionLayer(
                faceBox: faceBox,
                enabled: widget.interactiveRegionsAllowed,
                regions: widget.regions,
                selectedRegion: widget.selectedRegion,
                onRegionTap: widget.onRegionTap,
              ),
            ],
          ),
        );
      },
    );
  }
}
