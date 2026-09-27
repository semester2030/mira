import 'presentation/presentation_models.dart';

/// The order the viewer can swipe. Later pages are appended after slides
/// already on screen, so a new page stays ahead of the current slide.
class DiscoverBrowseSequence {
  static List<PresentationSlide> apply({
    required List<PresentationSlide> shown,
    required List<PresentationSlide> offers,
    required List<PresentationSlide> ads,
    required bool replaced,
  }) {
    final incoming = [...offers, ...ads];
    if (replaced) return _unique(incoming);
    final byId = <String, PresentationSlide>{for (final slide in incoming) slide.slotId: slide};
    final kept = <PresentationSlide>[for (final slide in shown) byId[slide.slotId] ?? slide];
    final seen = kept.map((slide) => slide.slotId).toSet();
    return [
      ...kept,
      for (final slide in incoming)
        if (seen.add(slide.slotId)) slide,
    ];
  }

  static List<PresentationSlide> _unique(List<PresentationSlide> slides) {
    final seen = <String>{};
    return [for (final slide in slides) if (seen.add(slide.slotId)) slide];
  }
}
