/// Roles and actions for one celebrity ad. Price stays on the original target.
class DiscoverAdLink {
  const DiscoverAdLink({
    required this.id,
    required this.disclosure,
    required this.caption,
    required this.advertiserName,
    required this.publisherName,
    required this.sellerName,
    required this.targetKind,
    required this.targetId,
    required this.priceHalalas,
    required this.openLink,
    required this.appointmentOperational,
  });

  final String id;
  final String disclosure;
  final String caption;
  final String advertiserName;
  final String publisherName;
  final String sellerName;
  final String targetKind;
  final String targetId;
  final int priceHalalas;
  final bool openLink;
  final bool appointmentOperational;

  String get disclosureLine => '$disclosure · المعلن: $advertiserName · الجهة: $sellerName · الناشر: $publisherName';

  bool get countsAsPurchase => false;

  bool get countsAsConfirmedAppointment => false;

  factory DiscoverAdLink.fromPublic(Map<String, dynamic> json) {
    final target = Map<String, dynamic>.from(json['target'] as Map);
    final actions = Map<String, dynamic>.from(json['actions'] as Map);
    final advertiser = Map<String, dynamic>.from(json['advertiser'] as Map);
    final publisher = Map<String, dynamic>.from(json['publisher'] as Map);
    final seller = Map<String, dynamic>.from(json['seller'] as Map);
    final url = target['externalUrl'] as String?;
    final validLink = url != null && _validUrl(url);
    return DiscoverAdLink(
      id: json['id'] as String,
      disclosure: json['disclosure'] as String? ?? 'إعلان',
      caption: json['captionAr'] as String? ?? '',
      advertiserName: advertiser['nameAr'] as String? ?? '',
      publisherName: publisher['nameAr'] as String? ?? '',
      sellerName: seller['nameAr'] as String? ?? '',
      targetKind: target['kind'] as String,
      targetId: target['id'] as String,
      priceHalalas: target['priceHalalas'] as int,
      openLink: actions['openLink'] == true && validLink && actions['purchaseCompleted'] != true,
      appointmentOperational: actions['appointmentOperational'] == true && actions['appointmentConfirmed'] != true,
    );
  }
}

bool _validUrl(String value) {
  final uri = Uri.tryParse(value);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) return false;
  return uri.scheme == 'https' || uri.scheme == 'http';
}
