/// Main-offer media may be images-only or a single video. Details may mix both.
enum CatalogMainOfferKind { images, video }

extension CatalogMainOfferKindCodec on CatalogMainOfferKind {
  String get wire => switch (this) {
        CatalogMainOfferKind.images => 'images',
        CatalogMainOfferKind.video => 'video',
      };

  static CatalogMainOfferKind? tryParse(String? raw) {
    return switch (raw?.trim().toLowerCase()) {
      'images' || 'image' || 'photos' || 'photo' => CatalogMainOfferKind.images,
      'video' => CatalogMainOfferKind.video,
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
  /// Main carousel / player slides. Cover images are never slides.
  static List<CatalogMediaLink> mainSlides(
    List<CatalogMediaLink> media, {
    CatalogMainOfferKind? kind,
  }) {
    final resolved = resolveKind(media, kind);
    final mains = _ordered(media.where((item) => _isMain(item, media)));
    if (resolved == CatalogMainOfferKind.video) {
      final videos = mains.where((item) => item.kind == 'video').toList();
      if (videos.isEmpty) return const [];
      return [videos.first];
    }
    return mains.where((item) => item.kind == 'image').toList();
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
    if (kind != null) return kind;
    final mains = _ordered(media.where((item) => _isMain(item, media)));
    final hasVideo = mains.any((item) => item.kind == 'video');
    final hasImage = mains.any((item) => item.kind == 'image');
    if (hasVideo && !hasImage) return CatalogMainOfferKind.video;
    return CatalogMainOfferKind.images;
  }

  /// True when legacy main rows still mix images and videos.
  static bool isLegacyMixedMain(List<CatalogMediaLink> media, {CatalogMainOfferKind? kind}) {
    if (kind != null) return false;
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
    if (kind == CatalogMainOfferKind.images) {
      if (mains.any((item) => item.kind == 'video')) {
        messages.add('عرض الصور لا يقبل فيديو في العرض الرئيسي.');
      }
      if (mains.where((item) => item.kind == 'image').isEmpty) {
        messages.add('عرض الصور يحتاج صورة واحدة على الأقل في العرض الرئيسي.');
      }
      if (covers.isNotEmpty) {
        messages.add('غلاف الفيديو يخص عرض الفيديو فقط.');
      }
    } else {
      final videos = mains.where((item) => item.kind == 'video').toList();
      if (videos.length != 1) {
        messages.add('عرض الفيديو يحتاج فيديو واحدًا فقط في العرض الرئيسي.');
      }
      if (mains.any((item) => item.kind == 'image')) {
        messages.add('صور العرض الرئيسي غير مسموحة مع عرض الفيديو. استخدم الغلاف إن لزم.');
      }
      if (covers.length > 1) {
        messages.add('يُسمح بغلاف واحد فقط للفيديو.');
      }
      if (covers.any((item) => item.kind != 'image')) {
        messages.add('غلاف الفيديو يجب أن يكون صورة.');
      }
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
