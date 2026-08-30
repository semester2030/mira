import 'package:flutter/material.dart';

import '../../../projection/contracts/face_result_enums.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../shared/face_experience_haptics.dart';
import '../mapping/face_region_hit_geometry.dart';

/// Soft semantic hit targets for high-level face regions (ILLUSTRATIVE).
class FaceRegionInteractionLayer extends StatelessWidget {
  const FaceRegionInteractionLayer({
    super.key,
    required this.faceBox,
    required this.enabled,
    required this.regions,
    required this.selectedRegion,
    required this.onRegionTap,
  });

  final Rect faceBox;
  final bool enabled;
  final List<FaceRegionAssociationVm> regions;
  final FacePresentationRegion? selectedRegion;
  final ValueChanged<FacePresentationRegion> onRegionTap;

  @override
  Widget build(BuildContext context) {
    if (!enabled || regions.isEmpty) return const SizedBox.shrink();

    final available = regions.map((r) => r.region).toSet();

    return Stack(
      children: [
        for (final region in available)
          Positioned.fromRect(
            rect: FaceRegionHitGeometry.rectFor(region, faceBox),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                FaceExperienceHaptics.selectionOptional();
                onRegionTap(region);
              },
              child: Semantics(
                button: true,
                selected: selectedRegion == region,
                label: 'منطقة ${_label(region)} — افتحي التفاصيل',
                child: const SizedBox.expand(),
              ),
            ),
          ),
      ],
    );
  }

  static String _label(FacePresentationRegion region) {
    switch (region) {
      case FacePresentationRegion.faceGeneral:
        return 'الوجه';
      case FacePresentationRegion.forehead:
        return 'الجبهة';
      case FacePresentationRegion.eyes:
        return 'العينين';
      case FacePresentationRegion.nose:
        return 'الأنف';
      case FacePresentationRegion.cheeks:
        return 'الخدين';
      case FacePresentationRegion.mouth:
        return 'الفم';
      case FacePresentationRegion.jaw:
        return 'الفك';
      case FacePresentationRegion.chin:
        return 'الذقن';
    }
  }
}
