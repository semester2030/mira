import 'package:flutter/material.dart';

import '../../../capture/contracts/face_capture_guidance_vm.dart';
import '../tokens/capture_mirror_tokens.dart';

/// Single primary instruction from 9B guidance VM — no duplicated Arabic copy.
class CaptureMirrorGuidanceBar extends StatelessWidget {
  final FaceCaptureGuidanceVm guidance;
  final bool locked;

  const CaptureMirrorGuidanceBar({
    super.key,
    required this.guidance,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: guidance.accessibilityLabel,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 180),
        opacity: locked ? 0.7 : 1,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 28),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: CaptureMirrorTokens.guidanceGlass,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: guidance.isReady
                  ? CaptureMirrorTokens.readyAccent.withValues(alpha: 0.55)
                  : CaptureMirrorTokens.pearl.withValues(alpha: 0.22),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                guidance.instructionAr,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  height: 1.25,
                ),
              ),
              if (guidance.titleAr.isNotEmpty &&
                  guidance.titleAr != guidance.instructionAr) ...[
                const SizedBox(height: 2),
                Text(
                  guidance.titleAr,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.62),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
