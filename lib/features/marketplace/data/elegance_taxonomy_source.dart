import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/mira_api_endpoints.dart';
import 'discover_catalog_query.dart';

/// One public taxonomy node from `GET /marketplace/taxonomy?lane=elegance`.
class EleganceTaxonomyNode {
  const EleganceTaxonomyNode({
    required this.id,
    required this.labelAr,
    required this.sort,
    required this.active,
    required this.browseOnly,
    required this.writeEnabled,
    this.parentId,
    this.imageKey,
    this.profileId,
    this.children = const [],
  });

  final String id;
  final String? parentId;
  final String labelAr;
  final int sort;
  final bool active;
  final bool browseOnly;
  final bool writeEnabled;
  final String? imageKey;
  final String? profileId;
  final List<String> children;

  factory EleganceTaxonomyNode.fromJson(Map<String, dynamic> json) {
    final kids = json['children'];
    return EleganceTaxonomyNode(
      id: '${json['id']}',
      parentId: json['parentId']?.toString(),
      labelAr: '${json['labelAr'] ?? json['id']}',
      sort: (json['sort'] is num) ? (json['sort'] as num).toInt() : 0,
      active: json['active'] != false,
      browseOnly: json['browseOnly'] == true,
      writeEnabled: json['writeEnabled'] != false && json['browseOnly'] != true,
      imageKey: json['imageKey']?.toString(),
      profileId: json['profileId']?.toString(),
      children: kids is List ? kids.map((e) => '$e').toList() : const [],
    );
  }
}

/// Shared elegance taxonomy projection for Discover circles (E3).
/// Source of truth = backend public taxonomy; local fallback mirrors the same ids.
abstract final class EleganceTaxonomySource {
  static List<EleganceTaxonomyNode> _nodes = const [];
  static String? _definitionsVersion;
  static DateTime? _loadedAt;
  /// When true, skip HTTP (widget/unit harness used [replaceForTest]).
  static bool _harnessLocked = false;

  static List<EleganceTaxonomyNode> get nodes => _nodes;
  static String? get definitionsVersion => _definitionsVersion;
  static bool get isLoaded => _nodes.isNotEmpty;

  /// Root browse circles for أناقتك (bags/shoes writeEnabled follows live taxonomy; E4 write started).
  static List<DiscoverCategoryDef> eleganceRoots({bool includeDeferredBrowse = true}) {
    final roots = _nodes.where((n) => n.parentId == null && n.active).toList()
      ..sort((a, b) => a.sort.compareTo(b.sort));
    if (roots.isEmpty) return _fallbackEleganceRoots();
    final out = <DiscoverCategoryDef>[];
    for (final n in roots) {
      if (!includeDeferredBrowse && (n.id == 'bags' || n.id == 'shoes')) continue;
      out.add(
        DiscoverCategoryDef(
          id: n.id == 'elegance.all' ? 'all' : n.id,
          label: n.labelAr,
          family: 'elegance',
          storedKey: n.browseOnly || n.id == 'elegance.all' ? '' : n.id,
          matchesAll: n.browseOnly || n.id == 'elegance.all',
          writeEnabled: n.writeEnabled,
          browseOnly: n.browseOnly || n.id == 'elegance.all',
          imageKey: n.imageKey,
        ),
      );
    }
    return out;
  }

  static List<DiscoverCategoryDef> childrenOf(String parentId) {
    EleganceTaxonomyNode? parent;
    for (final n in _nodes) {
      if (n.id == parentId) {
        parent = n;
        break;
      }
    }
    if (parent == null) return const [];
    final kids = <DiscoverCategoryDef>[];
    for (final id in parent.children) {
      EleganceTaxonomyNode? n;
      for (final x in _nodes) {
        if (x.id == id) {
          n = x;
          break;
        }
      }
      if (n == null || !n.active) continue;
      kids.add(
        DiscoverCategoryDef(
          id: n.id,
          label: n.labelAr,
          family: 'elegance',
          storedKey: n.browseOnly ? parentId : n.id,
          matchesAll: n.browseOnly,
          writeEnabled: n.writeEnabled,
          browseOnly: n.browseOnly,
          imageKey: n.imageKey,
          parentId: parentId,
        ),
      );
    }
    return kids;
  }

  static Future<bool> ensureLoaded({Dio? dio, bool force = false}) async {
    if (_harnessLocked && _nodes.isNotEmpty) return true;
    final withinTtl = _nodes.isNotEmpty &&
        _loadedAt != null &&
        DateTime.now().difference(_loadedAt!) < const Duration(minutes: 10);
    if (!force && withinTtl) return true;
    try {
      final client = dio ?? ApiClient.instance;
      final response = await client.get<Map<String, dynamic>>(
        MiraApiEndpoints.marketplaceTaxonomy,
        queryParameters: const {'lane': 'elegance'},
      );
      final data = response.data;
      if (data == null) return _nodes.isNotEmpty;
      final nextVersion = data['definitionsVersion']?.toString();
      // Same version + existing nodes: refresh TTL without rebuilding (cache policy).
      if (!force &&
          nextVersion != null &&
          nextVersion == _definitionsVersion &&
          _nodes.isNotEmpty) {
        _loadedAt = DateTime.now();
        return true;
      }
      final raw = data['nodes'];
      if (raw is! List) return _nodes.isNotEmpty;
      _nodes = raw
          .whereType<Map>()
          .map((e) => EleganceTaxonomyNode.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      _definitionsVersion = nextVersion;
      _loadedAt = DateTime.now();
      return _nodes.isNotEmpty;
    } catch (_) {
      if (_nodes.isEmpty) _nodes = _fallbackNodes();
      return _nodes.isNotEmpty;
    }
  }

  /// Call after portal publish / pull-to-refresh so a new definitionsVersion replaces cache.
  static Future<bool> reloadIfStale({Dio? dio}) => ensureLoaded(dio: dio, force: true);

  /// Test/harness: inject projection without HTTP.
  static void replaceForTest(List<EleganceTaxonomyNode> nodes, {String? definitionsVersion}) {
    _nodes = List.unmodifiable(nodes);
    _definitionsVersion = definitionsVersion;
    _loadedAt = DateTime.now();
    _harnessLocked = true;
  }

  static void clearCache() {
    _nodes = const [];
    _definitionsVersion = null;
    _loadedAt = null;
    _harnessLocked = false;
  }

  static List<DiscoverCategoryDef> _fallbackEleganceRoots() {
    return const [
      DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'elegance', storedKey: '', matchesAll: true, browseOnly: true),
      DiscoverCategoryDef(id: 'clothes', label: 'الملابس', family: 'elegance', storedKey: 'clothes', writeEnabled: true),
      DiscoverCategoryDef(id: 'bags', label: 'الشنط', family: 'elegance', storedKey: 'bags', writeEnabled: true),
      DiscoverCategoryDef(id: 'shoes', label: 'الأحذية', family: 'elegance', storedKey: 'shoes', writeEnabled: true),
      DiscoverCategoryDef(id: 'face', label: 'الوجه', family: 'elegance', storedKey: 'face', writeEnabled: true),
      DiscoverCategoryDef(id: 'body', label: 'الجسم', family: 'elegance', storedKey: 'body', writeEnabled: true),
      DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'elegance', storedKey: 'hair', writeEnabled: true),
      DiscoverCategoryDef(id: 'accessories', label: 'الإكسسوارات', family: 'elegance', storedKey: 'accessories', writeEnabled: true),
    ];
  }

  static List<EleganceTaxonomyNode> _fallbackNodes() {
    final defs = _fallbackEleganceRoots();
    return [
      for (var i = 0; i < defs.length; i++)
        EleganceTaxonomyNode(
          id: defs[i].id == 'all' ? 'elegance.all' : defs[i].id,
          labelAr: defs[i].label,
          sort: i * 10,
          active: true,
          browseOnly: defs[i].browseOnly,
          writeEnabled: defs[i].writeEnabled,
          imageKey: 'elegance.${defs[i].id == 'all' ? 'all' : defs[i].id}',
          children: const [],
        ),
    ];
  }
}
