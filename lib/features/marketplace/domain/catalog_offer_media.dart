/// Main-offer media: ordered mix of videos and images on Discover.
/// Independent caps: up to [maxMainVideos] videos and [maxMainImages] images.
enum CatalogMainOfferKind { images, video, gallery }

extension CatalogMainOfferKindCodec on CatalogMainOfferKind {
  String get wire => switch (this) {
        CatalogMainOfferKind.images => 'images',
        CatalogMainOfferKind.video => 'video',
        CatalogMainOfferKind.gallery => 'gallery',
      };

  static CatalogMainOfferKind? tryParse(String? raw) {
    return switch (raw?.trim().toLowerCase()) {
      'images' || 'image' || 'photos' || 'photo' => CatalogMainOfferKind.images,
      'video' => CatalogMainOfferKind.video,
      'gallery' || 'mixed' || 'multi' => CatalogMainOfferKind.gallery,
      _ => null,
    };
  }
}

/// Where a media row is used. The same file url may appear in more than one role.
abstract final class CatalogMediaPlacement {
  static const main = 'main';
  static const detail = 'detail';
  static const cover = 'cover';
}

class CatalogMediaLink {
  const CatalogMediaLink({
    required this.kind,
    required this.url,
    this.sortOrder = 0,
    this.isPrimary = false,
    this.placement = CatalogMediaPlacement.main,
  });

  final String kind;
  final String url;
  final int sortOrder;
  final bool isPrimary;

  /// One of [CatalogMediaPlacement.main], [CatalogMediaPlacement.detail], [CatalogMediaPlacement.cover].
  final String placement;
}

/// Resolves and validates main-offer vs detail media without copying files.
abstract final class CatalogOfferMedia {
  static const int maxMainVideos = 3;
  static const int maxMainImages = 10;

  /// Main carousel / player slides in partner [sortOrder]. Cover images are never slides.
  /// Caps: ≤[maxMainVideos] videos and ≤[maxMainImages] images (independent).
  static List<CatalogMediaLink> mainSlides(
    List<CatalogMediaLink> media, {
    CatalogMainOfferKind? kind,
  }) {
    final mains = _ordered(media.where((item) => _isMain(item, media)));
    final videos = <CatalogMediaLink>[];
    final images = <CatalogMediaLink>[];
    final out = <CatalogMediaLink>[];
    for (final item in mains) {
      if (item.kind == 'video') {
        if (videos.length >= maxMainVideos) continue;
        videos.add(item);
        out.add(item);
      } else if (item.kind == 'image') {
        if (images.length >= maxMainImages) continue;
        images.add(item);
        out.add(item);
      }
    }
    // Legacy wire kind=video with no images: keep first video only if empty mix
    // was produced (should not happen). Prefer full ordered mix always.
    if (out.isEmpty && kind == CatalogMainOfferKind.video) {
      final v = mains.where((item) => item.kind == 'video').take(1);
      return v.toList();
    }
    return out;
  }

  /// Poster shown while a main video loads. Not a swipeable slide.
  static CatalogMediaLink? videoCover(List<CatalogMediaLink> media) {
    final covers = _ordered(media.where((item) => item.placement == CatalogMediaPlacement.cover && item.kind == 'image'));
    if (covers.isNotEmpty) return covers.first;
    return null;
  }

  /// Detail gallery may mix images and videos in saved order.
  static List<CatalogMediaLink> detailMedia(List<CatalogMediaLink> media) {
    final explicit = _ordered(media.where((item) => item.placement == CatalogMediaPlacement.detail));
    if (explicit.isNotEmpty) return explicit;
    return _ordered(media);
  }

  static CatalogMainOfferKind resolveKind(List<CatalogMediaLink> media, CatalogMainOfferKind? kind) {
    if (kind == CatalogMainOfferKind.gallery) return CatalogMainOfferKind.gallery;
    if (kind != null) {
      // Explicit images/video still resolve; mixed rows upgrade to gallery.
      final mains = _ordered(media.where((item) => _isMain(item, media)));
      final hasVideo = mains.any((item) => item.kind == 'video');
      final hasImage = mains.any((item) => item.kind == 'image');
      if (hasVideo && hasImage) return CatalogMainOfferKind.gallery;
      return kind;
    }
    final mains = _ordered(media.where((item) => _isMain(item, media)));
    final hasVideo = mains.any((item) => item.kind == 'video');
    final hasImage = mains.any((item) => item.kind == 'image');
    if (hasVideo && hasImage) return CatalogMainOfferKind.gallery;
    if (hasVideo && !hasImage) return CatalogMainOfferKind.video;
    return CatalogMainOfferKind.images;
  }

  /// True when main rows mix images and videos (supported as gallery).
  static bool isLegacyMixedMain(List<CatalogMediaLink> media, {CatalogMainOfferKind? kind}) {
    final mains = media.where((item) => _isMain(item, media)).toList();
    return mains.any((item) => item.kind == 'image') && mains.any((item) => item.kind == 'video');
  }

  /// Returns Arabic validation messages. Empty means the assignment is valid.
  static List<String> validate({
    required CatalogMainOfferKind kind,
    required List<CatalogMediaLink> media,
  }) {
    final messages = <String>[];
    final mains = media.where((item) => item.placement == CatalogMediaPlacement.main).toList();
    final covers = media.where((item) => item.placement == CatalogMediaPlacement.cover).toList();
    final videoCount = mains.where((item) => item.kind == 'video').length;
    final imageCount = mains.where((item) => item.kind == 'image').length;

    if (videoCount > maxMainVideos) {
      messages.add('العرض الرئيسي يقبل حتى $maxMainVideos فيديوهات فقط.');
    }
    if (imageCount > maxMainImages) {
      messages.add('العرض الرئيسي يقبل حتى $maxMainImages صور فقط.');
    }
    if (mains.isEmpty) {
      messages.add('العرض الرئيسي يحتاج صورة أو فيديو واحدًا على الأقل.');
    }
    if (covers.length > 1) {
      messages.add('يُسمح بغلاف واحد فقط للفيديو.');
    }
    if (covers.any((item) => item.kind != 'image')) {
      messages.add('غلاف الفيديو يجب أن يكون صورة.');
    }
    // Legacy exclusive modes still accepted for old editors; gallery is the open path.
    if (kind == CatalogMainOfferKind.images && videoCount > 0 && imageCount == 0) {
      // pure video saved under images kind — allow via gallery rules above
    }
    return messages;
  }

  static bool _isMain(CatalogMediaLink item, List<CatalogMediaLink> all) {
    if (item.placement == CatalogMediaPlacement.cover) return false;
    if (item.placement == CatalogMediaPlacement.detail) return false;
    if (item.placement == CatalogMediaPlacement.main) return true;
    final hasExplicit = all.any((row) =>
        row.placement == CatalogMediaPlacement.main || row.placement == CatalogMediaPlacement.detail);
    return !hasExplicit;
  }

  static List<CatalogMediaLink> _ordered(Iterable<CatalogMediaLink> items) {
    final list = items.toList()
      ..sort((a, b) {
        final byOrder = a.sortOrder.compareTo(b.sortOrder);
        if (byOrder != 0) return byOrder;
        if (a.isPrimary != b.isPrimary) return a.isPrimary ? -1 : 1;
        return 0;
      });
    return list;
  }
}
