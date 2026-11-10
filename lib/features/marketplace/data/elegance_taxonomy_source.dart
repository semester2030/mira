import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart' show rootBundle;

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
    this.fieldIds = const [],
    this.filterKeys = const [],
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
  /// From central registry via taxonomy projection (Phase1).
  final List<String> fieldIds;
  final List<String> filterKeys;

  factory EleganceTaxonomyNode.fromJson(Map<String, dynamic> json) {
    final kids = json['children'];
    final fields = json['fieldIds'];
    final filters = json['filterKeys'];
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
      fieldIds: fields is List ? fields.map((e) => '$e').toList() : const [],
      filterKeys: filters is List ? filters.map((e) => '$e').toList() : const [],
    );
  }
}

/// Shared elegance taxonomy projection for Discover circles (E3).
/// Source of truth = backend public taxonomy; local fallback mirrors the same ids.
abstract final class EleganceTaxonomySource {
  static List<EleganceTaxonomyNode> _nodes = const [];
  static String? _definitionsVersion;
  static DateTime? _loadedAt;
  /// Lane + audience that currently populate [_nodes] (isolates elegance↔jewelry cache).
  static String? _cachedLane;
  static bool _cachedPartnerAudience = false;
  /// When true, skip HTTP (widget/unit harness used [replaceForTest]).
  static bool _harnessLocked = false;

  static List<EleganceTaxonomyNode> get nodes => _nodes;
  static String? get definitionsVersion => _definitionsVersion;
  static bool get isLoaded => _nodes.isNotEmpty;
  static String? get cachedLane => _cachedLane;
  static bool get cachedPartnerAudience => _cachedPartnerAudience;

  /// Root browse circles for أناقتك (bags/shoes writeEnabled follows live taxonomy; E4 write started).
  static List<DiscoverCategoryDef> eleganceRoots({bool includeDeferredBrowse = true}) {
    return rootsForFamily('elegance', includeDeferredBrowse: includeDeferredBrowse);
  }

  /// Roots for the currently cached lane projection (family == lane api id).
  /// Preview lanes with a single section root promote children (+ الكل) onto the rail.
  static List<DiscoverCategoryDef> rootsForFamily(
    String family, {
    bool includeDeferredBrowse = true,
  }) {
    if (_cachedLane != null && _cachedLane != family && family != 'elegance') {
      // Cache holds another lane — do not invent circles from the wrong projection.
      return const [];
    }
    final roots = _nodes.where((n) => n.parentId == null && n.active).toList()
      ..sort((a, b) => a.sort.compareTo(b.sort));
    if (roots.isEmpty && family == 'elegance') return _fallbackEleganceRoots();
    if (family != 'elegance') {
      final sectionRoots = roots
          .where((n) => !n.browseOnly && !n.id.endsWith('_lane.all') && !n.id.endsWith('.all'))
          .toList();
      if (sectionRoots.length == 1 && sectionRoots.first.children.isNotEmpty) {
        final parent = sectionRoots.first;
        final allChip = DiscoverCategoryDef(
          id: 'all',
          label: 'الكل',
          family: family,
          storedKey: '',
          matchesAll: true,
          browseOnly: true,
          imageKey: parent.imageKey ?? family,
        );
        final kids = childrenOf(parent.id, family: family)
            .where((c) => !c.matchesAll && c.id != '__back__')
            .toList();
        // Surface subcategories immediately (Phase3: show the 11 sub orbs).
        return [allChip, ...kids.map((c) => DiscoverCategoryDef(
              id: c.id,
              label: c.label,
              family: family,
              storedKey: c.storedKey,
              matchesAll: false,
              writeEnabled: c.writeEnabled,
              browseOnly: c.browseOnly,
              imageKey: c.imageKey,
              parentId: parent.id,
            ))];
      }
    }
    final out = <DiscoverCategoryDef>[];
    for (final n in roots) {
      if (family == 'elegance' && !includeDeferredBrowse && (n.id == 'bags' || n.id == 'shoes')) {
        continue;
      }
      if (family != 'elegance' && (n.id.endsWith('_lane.all') || n.id.endsWith('.all'))) {
        continue;
      }
      final isAll = n.browseOnly || n.id.endsWith('.all') || n.id == 'elegance.all';
      out.add(
        DiscoverCategoryDef(
          id: n.id == 'elegance.all' ? 'all' : n.id,
          label: n.labelAr,
          family: family,
          storedKey: isAll ? '' : n.id,
          matchesAll: isAll,
          writeEnabled: n.writeEnabled,
          browseOnly: isAll,
          imageKey: n.imageKey,
        ),
      );
    }
    return out;
  }

  static List<DiscoverCategoryDef> childrenOf(String parentId, {String? family}) {
    final fam = family ?? _cachedLane ?? 'elegance';
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
          family: fam,
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

  /// Loads taxonomy for [lane] from the live API. Preview lanes need [partnerAudience].
  /// Branch ids are never hardcoded here — adding a node server-side is enough.
  static Future<bool> ensureLoaded({
    Dio? dio,
    bool force = false,
    String lane = 'elegance',
    bool partnerAudience = false,
  }) async {
    if (_harnessLocked && _nodes.isNotEmpty && !force) return true;
    final sameScope = _cachedLane == lane && _cachedPartnerAudience == partnerAudience;
    final withinTtl = _nodes.isNotEmpty &&
        sameScope &&
        _loadedAt != null &&
        DateTime.now().difference(_loadedAt!) < const Duration(minutes: 10) &&
        !force;
    if (!force && withinTtl) return true;
    try {
      final client = dio ?? ApiClient.instance;
      final response = await client.get<Map<String, dynamic>>(
        MiraApiEndpoints.marketplaceTaxonomy,
        queryParameters: {
          'lane': lane,
          if (partnerAudience) 'audience': 'partner',
        },
      );
      final data = response.data;
      if (data == null) return sameScope && _nodes.isNotEmpty;
      final nextVersion = data['definitionsVersion']?.toString();
      // Same version + same lane/audience: refresh TTL without rebuilding.
      if (!force &&
          sameScope &&
          nextVersion != null &&
          nextVersion == _definitionsVersion &&
          _nodes.isNotEmpty) {
        _loadedAt = DateTime.now();
        return true;
      }
      final raw = data['nodes'];
      if (raw is! List) return sameScope && _nodes.isNotEmpty;
      _nodes = raw
          .whereType<Map>()
          .map((e) => EleganceTaxonomyNode.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      _definitionsVersion = nextVersion;
      _cachedLane = lane;
      _cachedPartnerAudience = partnerAudience;
      _loadedAt = DateTime.now();
      return _nodes.isNotEmpty;
    } catch (_) {
      if (lane == 'elegance') {
        if (_nodes.isEmpty || !sameScope) {
          _nodes = _fallbackNodes();
          _cachedLane = 'elegance';
          _cachedPartnerAudience = partnerAudience;
          _definitionsVersion = null;
          _loadedAt = DateTime.now();
        }
        return _nodes.isNotEmpty;
      }
      // Preview lanes: load bundled taxonomy JSON (local preview; publicBrowse stays false).
      return _loadBundledPreviewLane(lane, partnerAudience: partnerAudience);
    }
  }

  static const _bundledPreviewAssets = <String, String>{
    'jewelry': 'assets/marketplace/taxonomy/jewelry-taxonomy.v1.json',
    'children': 'assets/marketplace/taxonomy/children-taxonomy.v1.json',
    'gifts': 'assets/marketplace/taxonomy/gifts-taxonomy.v1.json',
    'occasions': 'assets/marketplace/taxonomy/occasions-taxonomy.v1.json',
  };

  static Future<bool> _loadBundledPreviewLane(
    String lane, {
    required bool partnerAudience,
  }) async {
    final asset = _bundledPreviewAssets[lane];
    if (asset == null) return false;
    try {
      final raw = await rootBundle.loadString(asset);
      final data = jsonDecode(raw);
      if (data is! Map) return false;
      final nodes = data['nodes'];
      if (nodes is! List) return false;
      _nodes = nodes
          .whereType<Map>()
          .map((e) => EleganceTaxonomyNode.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      _definitionsVersion = data['definitionsVersion']?.toString();
      _cachedLane = lane;
      _cachedPartnerAudience = partnerAudience;
      _loadedAt = DateTime.now();
      return _nodes.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Call after portal publish / pull-to-refresh so a new definitionsVersion replaces cache.
  static Future<bool> reloadIfStale({
    Dio? dio,
    String? lane,
    bool? partnerAudience,
  }) =>
      ensureLoaded(
        dio: dio,
        force: true,
        lane: lane ?? _cachedLane ?? 'elegance',
        partnerAudience: partnerAudience ?? _cachedPartnerAudience,
      );

  /// Test/harness: inject projection without HTTP.
  static void replaceForTest(
    List<EleganceTaxonomyNode> nodes, {
    String? definitionsVersion,
    String lane = 'elegance',
    bool partnerAudience = false,
  }) {
    _nodes = List.unmodifiable(nodes);
    _definitionsVersion = definitionsVersion;
    _cachedLane = lane;
    _cachedPartnerAudience = partnerAudience;
    _loadedAt = DateTime.now();
    _harnessLocked = true;
  }

  static void clearCache() {
    _nodes = const [];
    _definitionsVersion = null;
    _cachedLane = null;
    _cachedPartnerAudience = false;
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
