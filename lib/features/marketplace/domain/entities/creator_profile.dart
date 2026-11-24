/// Public creator (المشاهير) card from directory listing.
class CreatorDirectoryCard {
  const CreatorDirectoryCard({
    required this.id,
    required this.partnerId,
    required this.displayNameAr,
    this.avatarUrl,
  });

  final String id;
  final String partnerId;
  final String displayNameAr;
  final String? avatarUrl;
}

/// Full public creator profile including published ads and store flags.
class CreatorPublicProfile extends CreatorDirectoryCard {
  const CreatorPublicProfile({
    required super.id,
    required super.partnerId,
    required super.displayNameAr,
    super.avatarUrl,
    this.bioAr,
    required this.hasStore,
    required this.hasServices,
    required this.publishedAdIds,
    this.emptyAdsMessage,
    this.partnerType,
  });

  final String? bioAr;
  final bool hasStore;
  final bool hasServices;
  final List<String> publishedAdIds;
  final String? emptyAdsMessage;
  final String? partnerType;
}

class CreatorDirectoryPage {
  const CreatorDirectoryPage({
    required this.items,
    this.nextCursor,
    this.failed = false,
  });

  final List<CreatorDirectoryCard> items;
  final String? nextCursor;
  final bool failed;

  static const empty = CreatorDirectoryPage(items: []);
}