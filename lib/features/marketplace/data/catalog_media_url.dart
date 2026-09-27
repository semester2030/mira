/// Resolves a catalog media URL against the API origin.
/// A path that already starts with /api/v1 is not prefixed again.
String resolveCatalogMediaUrl(String url, String apiBase) {
  final trimmed = url.trim();
  final parsed = Uri.tryParse(trimmed);
  if (parsed != null && parsed.hasScheme) {
    if (parsed.isScheme('http') || parsed.isScheme('https')) return trimmed;
    throw FormatException('unsupported media url');
  }
  final base = Uri.parse(apiBase);
  final origin = Uri(
    scheme: base.scheme,
    host: base.host,
    port: base.hasPort ? base.port : null,
  );
  if (trimmed.startsWith('/')) return origin.resolve(trimmed).toString();
  final prefix = apiBase.endsWith('/') ? apiBase : '$apiBase/';
  return Uri.parse(prefix).resolve(trimmed).toString();
}
