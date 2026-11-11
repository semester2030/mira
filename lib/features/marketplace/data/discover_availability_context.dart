/// Discover filter state carried into booking so the same date/branch/offer
/// context used in browse applies to slot selection (partner-shared capacity).
class DiscoverAvailabilityContext {
  const DiscoverAvailabilityContext({
    this.availableOn,
    this.branchId,
    this.occasionTypeIds = const [],
    this.occasionServiceOffers = const [],
    this.laneApiId,
  });

  final String? availableOn;
  final String? branchId;
  final List<String> occasionTypeIds;
  final List<String> occasionServiceOffers;
  final String? laneApiId;

  bool get hasOccasionOfferContext => occasionServiceOffers.isNotEmpty || occasionTypeIds.isNotEmpty;
}
