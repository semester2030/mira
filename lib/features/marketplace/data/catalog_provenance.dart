/// How a payload was transported, separate from whether the content is demo.
enum CatalogTransport { server, localCatalog }

/// Explicit content mark. Absence of a mark is [unmarked], not "real".
enum ContentMark { explicitDemo, unmarked, mixed }

class CatalogLoad<T> {
  const CatalogLoad({
    required this.value,
    required this.transport,
    required this.contentMark,
  });

  final T value;
  final CatalogTransport transport;
  final ContentMark contentMark;

  static ContentMark combine(Iterable<ContentMark> marks) {
    if (marks.isEmpty) return ContentMark.unmarked;
    if (marks.contains(ContentMark.mixed)) return ContentMark.mixed;
    final set = marks.toSet();
    if (set.length > 1) return ContentMark.mixed;
    return set.single;
  }

  static ContentMark fromJsonFlag(Object? demoContent) {
    if (demoContent == true) return ContentMark.explicitDemo;
    return ContentMark.unmarked;
  }
}
