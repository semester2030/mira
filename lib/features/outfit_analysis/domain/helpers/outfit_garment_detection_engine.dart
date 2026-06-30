import 'dart:ui';

import '../../data/helpers/vision_color_mapper.dart';
import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../services/outfit_segmentation_service.dart';
import 'outfit_body_region_map.dart';
import 'outfit_fashion_taxonomy.dart';
import 'outfit_person_mask.dart';

/// Vision-only garment detection — real bounding boxes, no pose placeholders.
abstract final class OutfitGarmentDetectionEngine {
  OutfitGarmentDetectionEngine._();

  static const minConfidence = 0.82;
  static const minRegionOverlap = 0.22;

  static List<OutfitSegmentRegion> detect({
    required List<VisionLocalizedObject> visionObjects,
    required OutfitBodyPoseMetrics pose,
  }) {
    if (!OutfitPersonMask.isReady(pose)) return const [];

    final body = OutfitBodyRegionMap.fromPose(pose);
    final personBounds = OutfitPersonMask.bounds(pose)!;
    final candidates = <OutfitSegmentRegion>[];

    for (final object in visionObjects) {
      if (object.score < minConfidence) continue;
      if (!OutfitFashionTaxonomy.isFashionObject(object.name)) continue;

      final box = _tighten(object.normalizedBox);
      if (!_insidePerson(box, personBounds)) continue;

      final zone = OutfitFashionTaxonomy.zoneForObject(object.name, box);
      if (!_visibilityAllows(zone, object.name, body)) continue;
      if (!_validProportions(zone, box, body)) continue;
      if (!_zoneConsistent(zone, box, body)) continue;

      candidates.add(
        OutfitSegmentRegion(
          zone: zone,
          normalizedRect: box,
          labelAr: VisionColorMapper.labelToArabic(object.name),
          labelEn: object.name,
          confidence: object.score,
        ),
      );
    }

    final layered = _allowLayeredGarments(candidates);
    return _dedupeOverlapping(layered);
  }

  static bool _insidePerson(Rect box, Rect person) {
    final center = box.center;
    if (!person.contains(center)) return false;
    final inter = box.intersect(person);
    if (inter.isEmpty) return false;
    final interArea = inter.width * inter.height;
    final boxArea = box.width * box.height;
    if (boxArea <= 0) return false;
    return interArea / boxArea >= 0.72;
  }

  static bool _zoneConsistent(OutfitSegmentZone zone, Rect box, OutfitBodyRegionMap body) {
    final band = body.bandForZone(zone);
    final inter = box.intersect(band);
    if (inter.isEmpty) return false;
    final interArea = inter.width * inter.height;
    final boxArea = box.width * box.height;
    if (boxArea <= 0) return false;
    final overlap = interArea / boxArea;
    return overlap >= (zone == OutfitSegmentZone.accessories ? 0.10 : minRegionOverlap);
  }

  static bool _visibilityAllows(
    OutfitSegmentZone zone,
    String name,
    OutfitBodyRegionMap body,
  ) {
    if (OutfitFashionTaxonomy.isFootwear(name)) return body.feetVisible;
    if (OutfitFashionTaxonomy.isBag(name)) {
      return body.handsVisible || body.poseReliable;
    }
    if (_isNeckAccessoryEn(name)) return body.neckVisible;
    if (zone == OutfitSegmentZone.feet) return body.feetVisible;
    return true;
  }

  static bool _validProportions(
    OutfitSegmentZone zone,
    Rect box,
    OutfitBodyRegionMap body,
  ) {
    final area = box.width * box.height;
    if (area < 0.006) return false;

    return switch (zone) {
      OutfitSegmentZone.upperBody => box.height >= 0.06 && box.width >= 0.10,
      OutfitSegmentZone.lowerBody => box.height >= 0.08 && box.width >= 0.10,
      OutfitSegmentZone.feet =>
        body.feetVisible && box.height >= 0.03 && box.bottom >= 0.62,
      OutfitSegmentZone.accessories => area >= 0.003,
      _ => false,
    };
  }

  static Rect _tighten(Rect box) {
    const inset = 0.004;
    return Rect.fromLTRB(
      (box.left + inset).clamp(0, 1),
      (box.top + inset).clamp(0, 1),
      (box.right - inset).clamp(0, 1),
      (box.bottom - inset).clamp(0, 1),
    );
  }

  static List<OutfitSegmentRegion> _allowLayeredGarments(List<OutfitSegmentRegion> regions) {
    final upper = regions.where((r) => r.zone == OutfitSegmentZone.upperBody).toList()
      ..sort((a, b) => b.confidence.compareTo(a.confidence));
    final lower = regions.where((r) => r.zone == OutfitSegmentZone.lowerBody).toList()
      ..sort((a, b) => b.confidence.compareTo(a.confidence));
    final feet = regions.where((r) => r.zone == OutfitSegmentZone.feet).toList()
      ..sort((a, b) => b.confidence.compareTo(a.confidence));
    final acc = regions.where((r) => r.zone == OutfitSegmentZone.accessories).toList()
      ..sort((a, b) => b.confidence.compareTo(a.confidence));

    return [
      ...upper.take(2),
      ...lower.take(1),
      ...feet.take(1),
      ...acc.take(2),
    ];
  }

  static List<OutfitSegmentRegion> _dedupeOverlapping(List<OutfitSegmentRegion> regions) {
    final kept = <OutfitSegmentRegion>[];
    for (final region in regions) {
      final dominated = kept.any(
        (existing) =>
            existing.zone == region.zone &&
            _iou(existing.normalizedRect, region.normalizedRect) > 0.62 &&
            existing.confidence >= region.confidence,
      );
      if (dominated) continue;

      kept.removeWhere(
        (existing) =>
            existing.zone == region.zone &&
            _iou(existing.normalizedRect, region.normalizedRect) > 0.62 &&
            region.confidence > existing.confidence,
      );
      kept.add(region);
    }
    return kept;
  }

  static double _iou(Rect a, Rect b) {
    final inter = a.intersect(b);
    if (inter.isEmpty) return 0;
    final interArea = inter.width * inter.height;
    final union = a.width * a.height + b.width * b.height - interArea;
    if (union <= 0) return 0;
    return interArea / union;
  }

  static bool _isNeckAccessoryEn(String en) {
    final l = en.toLowerCase();
    return l.contains('necklace') ||
        l.contains('jewelry') ||
        l.contains('earring');
  }
}
