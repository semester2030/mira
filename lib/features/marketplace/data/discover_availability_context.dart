/// Discover filter state carried into booking so the same date/branch/offer
/// context used in browse applies to slot selection (partner-shared capacity).
class DiscoverAvailabilityContext {
  const DiscoverAvailabilityContext({
    this.availableOn,
    this.branchId,
    this.placeMode,
    this.visitCityId,
    this.occasionTypeIds = const [],
    this.occasionServiceOffers = const [],
    this.laneApiId,
  });

  final String? availableOn;
  final String? branchId;
  /// When Discover filtered to a single placeMode (branch|home).
  final String? placeMode;
  /// Resolved sa-* city id when Discover city filter maps to a known city.
  final String? visitCityId;
  final List<String> occasionTypeIds;
  final List<String> occasionServiceOffers;
  final String? laneApiId;

  bool get hasOccasionOfferContext => occasionServiceOffers.isNotEmpty || occasionTypeIds.isNotEmpty;
}
