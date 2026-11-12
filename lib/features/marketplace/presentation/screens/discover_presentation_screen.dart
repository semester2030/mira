import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/constants/mira_public_urls.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/mira_route_observer.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/beauty_id_compat.dart';
import '../../data/catalog_provenance.dart';
import '../../data/discover_catalog_gateway.dart';
import '../../data/catalog_record_scope.dart';
import '../../data/commerce_api_client.dart';
import '../../data/discover_favorite_client.dart';
import '../../data/discover_availability_context.dart';
import '../../data/discover_catalog_facets.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/discover_taxonomy_filters.dart';
import '../../data/discover_match_scope.dart';
import '../../data/elegance_taxonomy_source.dart';
import '../../data/saudi_cities.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/catalog_product_options.dart';
import '../../domain/entities/catalog_product.dart';
import '../presentation/discover_ad.dart';
import '../presentation/presentation_models.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../ad_link_open_outbox.dart';
import '../commerce_cart_actions.dart';
import '../widgets/product_option_selector.dart';
import '../discover_browse_sequence.dart';
import '../discover_feed_controller.dart';
import '../presentation/discover_presentation_catalog.dart';
import '../presentation/discover_view_count.dart';
import '../presentation/discover_visual_chrome.dart';
import '../presentation/presentation_video_port.dart';
import '../widgets/discover_scene_still.dart';
import '../intro_video_booking.dart';
import 'booking_request_screen.dart';
import 'partner_detail_screen.dart';

/// Full-screen Discover presentation. One product or service per page.
class DiscoverPresentationScreen extends StatefulWidget {
  const DiscoverPresentationScreen({
    super.key,
    this.lane,
    this.slides,
    this.videoPort,
    this.verticalController,
    this.gateway,
    this.favorites,
    this.recordAdLink,
    this.confirmAdLink,
    this.openExternal,
    this.linkOutbox,
    this.commerce,
  });

  final DiscoverLane? lane;
  final List<PresentationSlide>? slides;
  final PresentationVideoPort? videoPort;
  final PageController? verticalController;
  final DiscoverCatalogGateway? gateway;
  final DiscoverFavoriteClient? favorites;
  final AdLinkSender? recordAdLink;
  final AdLinkOpenOutbox? linkOutbox;
  final Future<bool> Function({required String adId, required String url})? confirmAdLink;
  final Future<bool> Function(Uri uri)? openExternal;

  /// Cart client for `internal_cod` products. Defaults to the signed-in account's API client.
  final CommerceClient? commerce;

  @override
  DiscoverPresentationScreenState createState() => DiscoverPresentationScreenState();
}

class DiscoverPresentationScreenState extends State<DiscoverPresentationScreen>
    with WidgetsBindingObserver, RouteAware {
  /// Same path as app-resume refresh; exposed for E3 open-screen acceptance only.
  @visibleForTesting
  Future<void> debugRefreshTaxonomyWhileOpen() => _refreshTaxonomyAndFeedWhileOpen();

  late List<PresentationSlide> _slides;
  late final PresentationVideoPort _video;
  late final bool _ownsVideo;
  late final PageController _vertical;
  ModalRoute<dynamic>? _route;
  int _page = 0;
  int _epoch = 0;
  bool _foreground = true;
  bool _covered = false;
  bool _released = false;
  final _catalog = MarketplaceRepositoryImpl();
  late final CommerceClient _commerce = widget.commerce ?? ApiCommerceClient();
  final _search = TextEditingController();
  final _searchFieldKey = GlobalKey();
  final _searchFocus = FocusNode();
  bool _searchOpen = false;
  DiscoverFavoriteClient? _favorites;
  var _ownsFavorites = false;
  DiscoverCatalogQuery _query = const DiscoverCatalogQuery();
  String? _nextCursor;
  List<String> _cities = const [];
  DiscoverCatalogFacets _facets = DiscoverCatalogFacets.empty;
  int? _totalMatched;
  CatalogTransport? _transport;
  int _category = 0;
  /// When set (e.g. `clothes`), the elegance rail shows subcategory circles instead of roots.
  String? _eleganceDrillParentId;
  DiscoverFeedController? _feed;
  DiscoverFeedPhase _phase = DiscoverFeedPhase.ready;
  bool _adsFailed = false;
  String? _loadError;
  String? _loadMoreError;
  int _replacement = 0;
  /// device = GPS after permission; cityCenter = explicit city midpoint (not "my location").
  String? _nearSourceLabelAr;

  bool get _catalogDriven => widget.slides == null;

  bool get _playable => _foreground && !_covered && !_released;

  @override
  void initState() {
    super.initState();
    if (_catalogDriven) {
      _slides = const [];
      _phase = DiscoverFeedPhase.loading;
      _feed = DiscoverFeedController(gateway: widget.gateway ?? _catalog);
      _feed!.addListener(_onFeed);
      _feed!.load(DiscoverCatalogQuery(lane: widget.lane, requireVisual: widget.lane != null));
      _favorites = widget.favorites ?? ApiDiscoverFavoriteClient();
      _ownsFavorites = widget.favorites == null;
      _favorites!.addListener(_onFavorites);
      _favorites!.refresh();
      // Load lane taxonomy so circles/filters use backend (or bundled preview) ids.
      final lane = widget.lane;
      if (lane == null || lane == DiscoverLane.elegance || lane.usesTaxonomyRail) {
        final apiLane = lane?.apiId ?? 'elegance';
        final partnerAudience = lane?.isPreviewLane ?? false;
        EleganceTaxonomySource.ensureLoaded(
          lane: apiLane,
          partnerAudience: partnerAudience,
        ).then((_) async {
          if (!mounted) return;
          setState(() {});
          await EleganceTaxonomySource.reloadIfStale(
            lane: apiLane,
            partnerAudience: partnerAudience,
          );
          if (mounted) setState(() {});
        });
      }
    } else {
      _slides = widget.slides!;
    }
    _ownsVideo = widget.videoPort == null;
    _video = widget.videoPort ?? AssetVideoPort();
    _vertical = widget.verticalController ?? PageController();
    WidgetsBinding.instance.addObserver(this);
    _video.addListener(_onVideo);
  }

  @override
  void didUpdateWidget(covariant DiscoverPresentationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.slides, widget.slides)) {
      if (widget.slides == null) {
        _feed?.load(_query);
      } else {
        _slides = widget.slides!;
      }
      _page = 0;
      if (_vertical.hasClients) _vertical.jumpToPage(0);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route == _route || route is! PageRoute<dynamic>) return;
    if (_route != null) miraRouteObserver.unsubscribe(this);
    _route = route;
    miraRouteObserver.subscribe(this, route);
  }

  @override
  void dispose() {
    _released = true;
    WidgetsBinding.instance.removeObserver(this);
    miraRouteObserver.unsubscribe(this);
    _video.removeListener(_onVideo);
    if (widget.verticalController == null) _vertical.dispose();
    _feed?.removeListener(_onFeed);
    _feed?.dispose();
    _favorites?.removeListener(_onFavorites);
    if (_ownsFavorites) _favorites?.dispose();
    _searchFocus.dispose();
    _search.dispose();
    _video.release();
    if (_ownsVideo) _video.dispose();
    super.dispose();
  }

  var _reportedReadFailure = false;

  void _onFavorites() {
    if (!mounted || _released) return;
    final client = _favorites;
    final failed = client?.readFailed ?? false;
    setState(() {});
    if (client == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _released || _favorites?.readFailed != failed) return;
      if (failed && !_reportedReadFailure) {
        _reportedReadFailure = true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('تعذر قراءة المفضلة'),
            action: SnackBarAction(
              label: 'إعادة قراءة المفضلة',
              onPressed: () => client.refresh(),
            ),
          ),
        );
      } else if (!failed && _reportedReadFailure) {
        _reportedReadFailure = false;
        ScaffoldMessenger.of(context).removeCurrentSnackBar();
      }
    });
  }

  void _onVideo() {
    if (!mounted || _released) return;
    setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (foreground == _foreground) return;
    _foreground = foreground;
    if (!foreground) {
      _video.pause();
    }
    _bump();
    // E3: real in-session refresh — resume revalidates taxonomy then reloads the open feed.
    final lane = widget.lane;
    if (foreground &&
        _catalogDriven &&
        (lane == null || lane == DiscoverLane.elegance || lane.usesTaxonomyRail)) {
      unawaited(_refreshTaxonomyAndFeedWhileOpen());
    }
  }

  Future<void> _refreshTaxonomyAndFeedWhileOpen() async {
    final lane = widget.lane;
    await EleganceTaxonomySource.reloadIfStale(
      lane: lane?.apiId ?? 'elegance',
      partnerAudience: lane?.isPreviewLane ?? false,
    );
    if (!mounted || _released) return;
    var next = _query;
    final sub = next.subcategoryId;
    if (sub != null && sub.isNotEmpty) {
      final stillActive = EleganceTaxonomySource.nodes.any((n) => n.id == sub && n.active);
      if (!stillActive) {
        // Incompatible subcategory filter is cleared; keep compatible root category.
        next = next.copyWith(clearSubcategory: true);
        _eleganceDrillParentId = null;
      }
    }
    final cat = next.categoryId;
    if (cat != null && cat.isNotEmpty && cat != 'all') {
      final catActive = EleganceTaxonomySource.nodes.any((n) => n.id == cat && n.active);
      if (!catActive) {
        next = next.copyWith(clearCategory: true, clearSubcategory: true);
        _eleganceDrillParentId = null;
      }
    }
    setState(() {});
    await _reload(next);
  }

  @override
  void didPushNext() {
    _covered = true;
    _video.pause();
    _bump();
  }

  @override
  void didPopNext() {
    if (_released) return;
    _covered = false;
    _bump();
  }

  void _bump() {
    if (!mounted || _released) return;
    setState(() => _epoch += 1);
  }

  void _onFeed() {
    final feed = _feed;
    if (feed == null || !mounted) return;
    void apply() {
      if (!mounted) return;
      final next = feed.state;
      final replaced = next.replacement != _replacement;
      final previousKey = _slides.isEmpty ? null : _slides[_page.clamp(0, _slides.length - 1)].slotId;
      setState(() {
        _phase = next.phase;
        _query = next.query;
        _reconcileEleganceDrill(next.query);
        _slides = DiscoverBrowseSequence.apply(
          shown: _slides,
          offers: next.offers.map(DiscoverPresentationCatalog.slideForOffer).toList(),
          ads: [
            for (final ad in next.ads)
              presentationSlideFromAd(
                ad.link,
                product: ad.product,
                service: ad.service,
                media: [
                  for (final item in ad.media)
                    PresentationMedia(
                      kind: item.kind == 'video' ? PresentationMediaKind.video : PresentationMediaKind.image,
                      assetPath: item.url,
                      network: true,
                    ),
                ],
              ),
          ],
          replaced: replaced,
        );
        _nextCursor = next.nextCursor;
        _cities = next.cities;
        _facets = next.facets;
        _totalMatched = next.totalMatched;
        _transport = next.transport;
        _loadError = next.loadError;
        _loadMoreError = next.loadMoreError;
        _adsFailed = next.adsFailed;
        _category = _categoryIndex(next.query);
        _replacement = next.replacement;
        if (replaced) {
          _page = 0;
        } else if (previousKey != null) {
          final kept = _slides.indexWhere((slide) => slide.slotId == previousKey);
          if (kept >= 0) _page = kept;
        }
        if (_page >= _slides.length) _page = 0;
      });
      // E3: strip incompatible facet selections reported by the server (same contract as portal).
      final stale = next.facets.staleSelections;
      if (stale.isNotEmpty) {
        final dropColors = stale.where((s) => s.field == 'variant.color').map((s) => s.value).toSet();
        final dropSizes = stale.where((s) => s.field == 'variant.size').map((s) => s.value).toSet();
        final dropVolumes = stale.where((s) => s.field == 'variant.volume').map((s) => s.value).toSet();
        final dropShoeUsage = stale.where((s) => s.field == 'shoeUsage').map((s) => s.value).toSet();
        final dropOccasionType = stale.where((s) => s.field == 'occasionType').map((s) => s.value).toSet();
        final dropOccasionOffer =
            stale.where((s) => s.field == 'occasionServiceOffer').map((s) => s.value).toSet();
        final nextColors = next.query.colors.where((c) => !dropColors.contains(c)).toList();
        final nextSizes = next.query.sizes.where((c) => !dropSizes.contains(c)).toList();
        final nextVolumes = next.query.volumes.where((c) => !dropVolumes.contains(c)).toList();
        final nextShoeUsage = next.query.shoeUsage.where((c) => !dropShoeUsage.contains(c)).toList();
        final nextOccasionType =
            next.query.occasionTypeIds.where((c) => !dropOccasionType.contains(c)).toList();
        final nextOccasionOffer =
            next.query.occasionServiceOffers.where((c) => !dropOccasionOffer.contains(c)).toList();
        if (nextColors.length != next.query.colors.length ||
            nextSizes.length != next.query.sizes.length ||
            nextVolumes.length != next.query.volumes.length ||
            nextShoeUsage.length != next.query.shoeUsage.length ||
            nextOccasionType.length != next.query.occasionTypeIds.length ||
            nextOccasionOffer.length != next.query.occasionServiceOffers.length) {
          _reload(
            next.query.copyWith(
              colors: nextColors,
              sizes: nextSizes,
              volumes: nextVolumes,
              shoeUsage: nextShoeUsage,
              occasionTypeIds: nextOccasionType,
              occasionServiceOffers: nextOccasionOffer,
            ),
          );
          return;
        }
      }
      if (_vertical.hasClients && (_vertical.page?.round() ?? 0) != _page) {
        _vertical.jumpToPage(_page);
      }
      _warmAround(_page);
    }

    final phase = WidgetsBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.idle) {
      apply();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => apply());
    }
  }

  void _onPage(int index) {
    setState(() => _page = index);
    _warmAround(index);
    if (_catalogDriven && _nextCursor != null && index >= _slides.length - 1) {
      _feed?.loadMore();
    }
  }

  String? _videoPath(PresentationSlide slide) {
    for (final item in slide.media) {
      if (item.kind == PresentationMediaKind.video && item.assetPath.isNotEmpty) return item.assetPath;
    }
    return null;
  }

  void _warmAround(int index) {
    final port = _video;
    if (index < 0 || index >= _slides.length) return;
    if (port is AssetVideoPort) {
      final next = index + 1 < _slides.length ? _videoPath(_slides[index + 1]) : null;
      if (next != null) port.warm(next);
    }
    if (!mounted) return;
    final ahead = index + 1 < _slides.length ? _slides[index + 1] : null;
    if (ahead == null) return;
    for (final item in ahead.media.take(3)) {
      final path = item.assetPath;
      if (item.kind != PresentationMediaKind.image || path.isEmpty) continue;
      final ImageProvider provider = path.startsWith('http://') || path.startsWith('https://') ? NetworkImage(path) : AssetImage(path);
      precacheImage(provider, context);
    }
  }

  Future<void> _reload(DiscoverCatalogQuery query) =>
      _feed?.load(query.scopedToTaxonomyBranch()) ?? Future.value();

  DiscoverAvailabilityContext get _availabilityContext => DiscoverAvailabilityContext(
        availableOn: _query.availableOn,
        branchId: _query.branchIds.length == 1 ? _query.branchIds.first : null,
        placeMode: _query.placeModes.length == 1 ? _query.placeModes.first : null,
        visitCityId: resolveSaudiCity(_query.city)?.id,
        occasionTypeIds: _query.occasionTypeIds,
        occasionServiceOffers: _query.occasionServiceOffers,
        laneApiId: widget.lane?.apiId,
      );

  bool _allowFilter(String filterKey) {
    if (widget.lane == null) return false;
    final keys = DiscoverTaxonomyFilters.keysForQuery(
      lane: widget.lane,
      categoryId: _query.categoryId,
      subcategoryId: _query.subcategoryId,
    );
    if (keys.isEmpty) {
      return DiscoverTaxonomyFilters.laneDefaults[widget.lane!.apiId]?.contains(filterKey) ?? false;
    }
    return keys.contains(filterKey);
  }

  bool get _laneProductFilters =>
      _allowFilter('variant.color') ||
      _allowFilter('variant.size') ||
      _allowFilter('variant.volume') ||
      _allowFilter('metal') ||
      _allowFilter('purity') ||
      _allowFilter('shoeUsage') ||
      _allowFilter('inStock') ||
      _allowFilter('giftEligible') ||
      _allowFilter('ageMonths');

  bool get _laneServiceFilters =>
      _allowFilter('placeMode') ||
      _allowFilter('branch') ||
      _allowFilter('availableOn') ||
      _allowFilter('duration') ||
      _allowFilter('occasionType') ||
      _allowFilter('occasionServiceOffer');

  /// Clears subcategory drill UI so rail circles match a root-level / empty query.
  void _clearEleganceDrill({bool notify = true}) {
    if (_eleganceDrillParentId == null && _category == 0) return;
    void apply() {
      _eleganceDrillParentId = null;
      _category = 0;
    }

    if (notify && mounted) {
      setState(apply);
    } else {
      apply();
    }
  }

  /// Portal persists legacy Service.category (hair/makeup/…); taxonomy mids are beauty.*.
  String? _beautyLegacyCategoryFor(String? taxonomyOrLegacy) =>
      legacyBeautyCategoryFor(taxonomyOrLegacy);

  /// Keep drill parent only when query still targets that category / subcategory.
  void _reconcileEleganceDrill(DiscoverCatalogQuery query) {
    final parent = _eleganceDrillParentId;
    if (parent == null) return;
    final cat = query.categoryId;
    final sub = query.subcategoryId;
    // Beauty venue roots (salons/clinics) clear category and filter by partnerType.
    if (parent == 'beauty.salons' || parent == 'beauty.clinics') {
      final want = parent == 'beauty.salons' ? 'salon' : 'clinic';
      if (query.partnerType == want) return;
      // Deeper beauty mid-node (beauty.hair) while still under venue.
      if (cat != null && cat.startsWith('beauty.') && query.partnerType == want) return;
      if (cat != null && const {'hair', 'makeup', 'nails', 'care', 'skin', 'laser', 'teeth'}.contains(cat)) {
        return;
      }
    }
    final stillOnParent = cat == parent ||
        (sub != null && sub.startsWith('$parent.')) ||
        (cat != null && cat.startsWith('$parent.'));
    if (!stillOnParent || cat == null || cat == 'all') {
      _eleganceDrillParentId = null;
    }
  }

  int _categoryIndexFor(PresentationSlide slide) {
    return _categoryIndex(_query);
  }

  int _categoryIndex(DiscoverCatalogQuery query) {
    final items = _railDefs();
    if (_eleganceDrillParentId != null) {
      if (query.subcategoryId != null && query.subcategoryId!.isNotEmpty) {
        final sub = items.indexWhere((item) => item.id == query.subcategoryId);
        if (sub >= 0) return sub;
      }
      final allIdx = items.indexWhere((item) => item.id != '__back__' && item.matchesAll);
      return allIdx >= 0 ? allIdx : (_category.clamp(0, items.isEmpty ? 0 : items.length - 1));
    }
    final index = items.indexWhere((item) => item.id == (query.categoryId ?? 'all'));
    return index < 0 ? 0 : index;
  }

  String _queryFamily(DiscoverCatalogQuery query) {
    if (query.lane != null) return query.lane!.assetFamily;
    return switch (query.partnerType) {
      'clinic' => 'clinic',
      'salon' => 'salon',
      _ => 'product',
    };
  }

  String _activeFamily() {
    if (widget.lane != null) return widget.lane!.assetFamily;
    return _slides.isEmpty ? 'product' : _familyOf(_slides[_page.clamp(0, _slides.length - 1)]);
  }

  String _familyOf(PresentationSlide slide) {
    final type = slide.service?.partnerType;
    if (type == 'clinic') return 'clinic';
    if (type == 'salon') return 'salon';
    return 'product';
  }

  List<DiscoverCategoryDef> _taxonomyRailDefs(String family) {
    final parent = _eleganceDrillParentId;
    if (parent != null && parent.isNotEmpty) {
      final kids = EleganceTaxonomySource.childrenOf(parent, family: family);
      if (kids.isNotEmpty) {
        return [
          DiscoverCategoryDef(
            id: '__back__',
            label: 'رجوع',
            family: family,
            storedKey: '',
            matchesAll: true,
            browseOnly: true,
            // Nav control — not a service orb (avoid looking like a beauty section).
            imageKey: null,
          ),
          ...kids,
        ];
      }
    }
    return DiscoverCatalogQueryEngine.forFamily(family);
  }

  List<DiscoverCategoryDef> _railDefs() {
    final family = _activeFamily();
    if (widget.lane?.usesTaxonomyRail == true || family == 'elegance') {
      return _taxonomyRailDefs(family == 'product' ? 'elegance' : family);
    }
    return DiscoverCatalogQueryEngine.forFamily(family);
  }

  void _onCategory(int index) {
    final family = _activeFamily();
    final items = _railDefs();
    if (index < 0 || index >= items.length) return;
    final selected = items[index];
    setState(() => _category = index);

    // Taxonomy drill: back to root circles.
    if (selected.id == '__back__') {
      _clearEleganceDrill();
      _reload(
        _query.copyWith(
          lane: widget.lane ?? DiscoverLane.elegance,
          requireVisual: true,
          clearCategory: true,
          clearSubcategory: true,
          clearType: true,
          // Keep filters; server staleSelections + _onFeed prune incompatible ones.
        ),
      );
      return;
    }

    // Beauty «في موقعك»: place filter only — do not rewrite provider type.
    if (widget.lane == DiscoverLane.beauty && selected.id == 'beauty.home_visit') {
      _eleganceDrillParentId = null;
      _reload(
        _query.copyWith(
          lane: DiscoverLane.beauty,
          requireVisual: true,
          clearCategory: true,
          clearSubcategory: true,
          clearType: true,
          placeModes: const ['home'],
        ),
      );
      return;
    }

    // تجهيز العروس: OR across bridal-compatible leaves (not a service leaf itself).
    if (widget.lane == DiscoverLane.beauty && selected.id == 'beauty.bridal_prep') {
      _eleganceDrillParentId = null;
      const bridalLeaves =
          'beauty.makeup.bridal,beauty.makeup.bridal_trial,beauty.hair.updo,beauty.henna.bridal,beauty.henna.group';
      _reload(
        _query.copyWith(
          lane: DiscoverLane.beauty,
          requireVisual: true,
          clearCategory: true,
          subcategoryId: bridalLeaves,
          clearType: true,
          clearPlaceModes: true,
        ),
      );
      return;
    }

    // Taxonomy drill: root/mid node with children replaces rail with subtypes.
    final usesTaxonomy =
        widget.lane?.usesTaxonomyRail == true || family == 'elegance';
    final canDrillRoot = _eleganceDrillParentId == null && selected.parentId == null;
    final canDrillBeautyMid =
        widget.lane == DiscoverLane.beauty &&
        _eleganceDrillParentId != null &&
        selected.id.startsWith('beauty.') &&
        !selected.browseOnly;
    if (usesTaxonomy &&
        (canDrillRoot || canDrillBeautyMid) &&
        !selected.matchesAll &&
        selected.id != '__back__') {
      final kids = EleganceTaxonomySource.childrenOf(selected.id, family: family);
      if (kids.isNotEmpty) {
        _eleganceDrillParentId = selected.id;
        setState(() => _category = 0);
        final isVenue = selected.venueType != null;
        _reload(
          _query.copyWith(
            lane: widget.lane ?? DiscoverLane.elegance,
            requireVisual: true,
            categoryId: isVenue ? null : (selected.storedKey.isEmpty ? selected.id : selected.storedKey),
            clearCategory: isVenue,
            clearSubcategory: true,
            partnerType: selected.venueType ?? _query.partnerType,
            clearType: selected.venueType == null && _query.partnerType == null,
            clearPlaceModes: true,
          ),
        );
        return;
      }
    }

    // Beauty leaves: send legacy category (hair) + leaf id so portal-persisted rows match.
    // Mid drill parent may be beauty.hair; storedKey on mid chips is already legacy.
    String? rootCategoryId = _eleganceDrillParentId ??
        (selected.parentId != null
            ? selected.parentId
            : (selected.matchesAll ? null : (selected.storedKey.isEmpty ? selected.id : selected.storedKey)));
    final nextSubcategory =
        selected.parentId != null && !selected.matchesAll && !selected.browseOnly ? selected.id : null;
    if (widget.lane == DiscoverLane.beauty && nextSubcategory != null && nextSubcategory.startsWith('beauty.')) {
      rootCategoryId = _beautyLegacyCategoryFor(nextSubcategory) ??
          _beautyLegacyCategoryFor(_eleganceDrillParentId) ??
          rootCategoryId;
    } else if (widget.lane == DiscoverLane.beauty &&
        rootCategoryId != null &&
        rootCategoryId.startsWith('beauty.')) {
      rootCategoryId = _beautyLegacyCategoryFor(rootCategoryId) ?? rootCategoryId;
    }

    if (widget.lane != null) {
      final clearHome = selected.id != 'beauty.home_visit' && _query.placeModes.contains('home');
      // Home place filter must not quietly rewrite provider type.
      final clearType = selected.venueType == null && selected.id != 'beauty.home_visit';
      _reload(
        _query.copyWith(
          lane: widget.lane,
          requireVisual: true,
          categoryId: rootCategoryId,
          subcategoryId: nextSubcategory,
          clearCategory: rootCategoryId == null || rootCategoryId == 'all',
          clearSubcategory: nextSubcategory == null,
          clearType: clearType,
          partnerType: selected.venueType,
          clearPlaceModes: clearHome || selected.matchesAll,
          // Compatible filters retained; incompatible pruned via facets.staleSelections.
        ),
      );
      return;
    }
    final type = switch (family) {
      'clinic' => 'clinic',
      'salon' => 'salon',
      _ => 'brand',
    };
    _reload(
      _query.copyWith(
        partnerType: selected.matchesAll ? _query.partnerType : type,
        categoryId: selected.id,
        clearCategory: selected.matchesAll,
        clearSubcategory: true,
      ),
    );
  }

  String _familyType(PresentationSlide slide) {
    final type = slide.service?.partnerType;
    if (type == 'clinic' || type == 'salon') return type!;
    return 'brand';
  }

  void _tell(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Color? _swatchColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    var value = hex.trim();
    if (value.startsWith('#')) value = value.substring(1);
    if (value.length == 6) value = 'FF$value';
    final parsed = int.tryParse(value, radix: 16);
    if (parsed == null) return null;
    return Color(parsed);
  }

  Future<void> _openFilters(BuildContext context) async {
    final elegance = widget.lane == DiscoverLane.elegance ||
        (widget.lane == null && (_query.partnerType == null || _query.partnerType == 'brand'));
    final beauty = widget.lane == DiscoverLane.beauty ||
        (_query.partnerType == 'clinic' || _query.partnerType == 'salon');
    final cityBuckets = _facets.city.isNotEmpty
        ? _facets.city
        : [for (final city in _cities) DiscoverFacetBucket(id: city, count: 0, labelAr: city)];
    final colorBuckets = [
      ..._facets.colors,
      for (final id in _query.colors)
        if (!_facets.colors.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final sizeBuckets = [
      ..._facets.sizes,
      for (final id in _query.sizes)
        if (!_facets.sizes.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final volumeBuckets = [
      ..._facets.volumes,
      for (final id in _query.volumes)
        if (!_facets.volumes.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final shoeUsageBuckets = [
      ..._facets.shoeUsage,
      for (final id in _query.shoeUsage)
        if (!_facets.shoeUsage.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final metalBuckets = [
      ..._facets.metal,
      for (final id in _query.metals)
        if (!_facets.metal.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final purityBuckets = [
      ..._facets.purity,
      for (final id in _query.purityKarats)
        if (!_facets.purity.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final occasionTypeBuckets = [
      ..._facets.occasionType,
      for (final id in _query.occasionTypeIds)
        if (!_facets.occasionType.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    final occasionOfferBuckets = [
      ..._facets.occasionServiceOffer,
      for (final id in _query.occasionServiceOffers)
        if (!_facets.occasionServiceOffer.any((b) => b.id == id))
          DiscoverFacetBucket(id: id, count: 0, labelAr: id),
    ];
    const placeLabels = {
      'branch': 'في المقر',
      'home': 'في موقعك',
      'remote': 'عن بعد',
      'either': 'في المقر أو موقعك',
    };
    final placeBuckets = _facets.placeMode.isNotEmpty
        ? _facets.placeMode
        : [
            for (final e in placeLabels.entries)
              DiscoverFacetBucket(id: e.key, count: 0, labelAr: e.value),
          ];

    final type = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  title: Text(
                    _totalMatched == null
                        ? (_query.activeFilterCount == 0 ? 'الفلاتر' : 'الفلاتر (${_query.activeFilterCount})')
                        : 'النتائج: $_totalMatched',
                  ),
                  subtitle: Text(
                    _facets.staleSelections.isEmpty
                        ? 'اختاري ما يناسبك ثم امسحي أي فلتر بسهولة'
                        : 'بعض الاختيارات لم تعد متاحة في النتائج الحالية',
                  ),
                ),
                if (widget.lane == null) ...[
                  ListTile(title: const Text('كل الأنواع'), onTap: () => Navigator.pop(context, 'all')),
                  ListTile(title: const Text('منتجات'), onTap: () => Navigator.pop(context, 'brand')),
                  ListTile(title: const Text('عيادات'), onTap: () => Navigator.pop(context, 'clinic')),
                  ListTile(title: const Text('مشاغل'), onTap: () => Navigator.pop(context, 'salon')),
                ],
                const ListTile(title: Text('المدينة')),
                ListTile(
                  leading: const Icon(Icons.search),
                  title: const Text('بحث عن مدينة سعودية…'),
                  subtitle: Text(_query.city == null || _query.city!.isEmpty
                      ? 'قائمة قابلة للبحث بدل مدينتين فقط'
                      : 'المحددة: ${_query.city}'),
                  onTap: () => Navigator.pop(context, 'citySearch'),
                ),
                if (widget.lane == DiscoverLane.beauty ||
                    _query.partnerType == 'clinic' ||
                    _query.partnerType == 'salon')
                  ListTile(
                    leading: const Icon(Icons.near_me_outlined),
                    title: const Text('بالقرب مني'),
                    subtitle: Text(
                      _nearSourceLabelAr ??
                          (_query.nearLat != null
                              ? 'ترتيب تقريبي بالمسافة مفعّل'
                              : 'يستخدم موقع الجهاز بعد الإذن — عند الرفض اختاري مدينة أو نقطة يدويًا'),
                    ),
                    trailing: _query.sort == 'distance' ? const Icon(Icons.check) : null,
                    onTap: () => Navigator.pop(context, 'nearby'),
                  ),
                  for (final city in cityBuckets.take(12))
                    ListTile(
                      title: Text(city.displayLabel),
                      subtitle: city.count > 0 ? Text('${city.count}') : null,
                      trailing: _query.city == city.id ||
                              resolveSaudiCity(_query.city)?.id == city.id
                          ? const Icon(Icons.check)
                          : null,
                      onTap: () => Navigator.pop(context, 'city:${city.id}'),
                    ),
                if (elegance || (widget.lane != null && _laneProductFilters)) ...[
                  const Divider(),
                  if (elegance || _allowFilter('variant.color')) ...[
                  const ListTile(title: Text('اللون')),
                  if (colorBuckets.isEmpty)
                    const ListTile(title: Text('لا توجد ألوان منشورة مطابقة حاليًا')),
                  for (final color in colorBuckets)
                    ListTile(
                      leading: CircleAvatar(
                        radius: 12,
                        backgroundColor: _swatchColor(color.swatchHex) ?? Colors.grey.shade300,
                        child: _query.colors.contains(color.id)
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : null,
                      ),
                      title: Text(color.displayLabel),
                      subtitle: Text(
                        [
                          if (color.count > 0) '${color.count}',
                          if (color.swatchHex == null) 'لون غير محدد',
                        ].join(' · '),
                      ),
                      trailing: _query.colors.contains(color.id) ? const Icon(Icons.check) : null,
                      onTap: () => Navigator.pop(context, 'color:${color.id}'),
                    ),
                  ],
                  if (elegance || _allowFilter('variant.size')) ...[
                  const ListTile(title: Text('المقاس')),
                  if (sizeBuckets.isEmpty)
                    const ListTile(title: Text('لا توجد مقاسات منشورة مطابقة حاليًا')),
                  for (final size in sizeBuckets)
                    ListTile(
                      title: Text(size.displayLabel),
                      subtitle: size.count > 0 ? Text('${size.count}') : null,
                      trailing: _query.sizes.contains(size.id) ? const Icon(Icons.check) : null,
                      onTap: () => Navigator.pop(context, 'size:${size.id}'),
                    ),
                  ],
                  if ((elegance || _allowFilter('variant.volume')) && volumeBuckets.isNotEmpty) ...[
                    const ListTile(title: Text('الحجم')),
                    for (final volume in volumeBuckets)
                      ListTile(
                        title: Text(volume.displayLabel),
                        subtitle: volume.count > 0 ? Text('${volume.count}') : null,
                        trailing: _query.volumes.contains(volume.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'volume:${volume.id}'),
                      ),
                  ],
                  if (_allowFilter('metal') || metalBuckets.isNotEmpty) ...[
                    const ListTile(title: Text('المعدن')),
                    for (final metal in metalBuckets)
                      ListTile(
                        title: Text(metal.displayLabel),
                        subtitle: metal.count > 0 ? Text('${metal.count}') : null,
                        trailing: _query.metals.contains(metal.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'metal:${metal.id}'),
                      ),
                  ],
                  if (_allowFilter('purity') || purityBuckets.isNotEmpty) ...[
                    const ListTile(title: Text('العيار')),
                    for (final purity in purityBuckets)
                      ListTile(
                        title: Text(purity.displayLabel),
                        subtitle: purity.count > 0 ? Text('${purity.count}') : null,
                        trailing: _query.purityKarats.contains(purity.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'purity:${purity.id}'),
                      ),
                  ],
                  if (shoeUsageBuckets.isNotEmpty ||
                      _allowFilter('shoeUsage') ||
                      _query.categoryId == 'shoes' ||
                      (_query.subcategoryId?.startsWith('shoes.') ?? false)) ...[
                    const ListTile(title: Text('استخدام الحذاء')),
                    for (final usage in shoeUsageBuckets.isNotEmpty
                        ? shoeUsageBuckets
                        : const [
                            DiscoverFacetBucket(id: 'formal', count: 0, labelAr: 'رسمي'),
                            DiscoverFacetBucket(id: 'daily', count: 0, labelAr: 'يومي'),
                            DiscoverFacetBucket(id: 'occasions', count: 0, labelAr: 'مناسبات'),
                          ])
                      ListTile(
                        title: Text(usage.displayLabel),
                        subtitle: usage.count > 0 ? Text('${usage.count}') : null,
                        trailing: _query.shoeUsage.contains(usage.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'shoeUsage:${usage.id}'),
                      ),
                  ],
                  if (elegance || _allowFilter('inStock'))
                    SwitchListTile(
                      title: const Text('المتاح بالمخزون فقط'),
                      value: _query.inStock == true,
                      onChanged: (_) => Navigator.pop(context, 'stock'),
                    ),
                  if (elegance || _allowFilter('price'))
                  ListTile(
                    title: Text(_priceRangeLabel()),
                    subtitle: const Text('حد أدنى وحد أعلى بالريال'),
                    trailing: (_query.priceMinHalalas != null || _query.priceMaxHalalas != null)
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () => Navigator.pop(context, 'clearPrice'),
                          )
                        : null,
                    onTap: () => Navigator.pop(context, 'priceRange'),
                  ),
                ],
                if (_allowFilter('occasionType') || occasionTypeBuckets.isNotEmpty) ...[
                  const Divider(),
                  const ListTile(title: Text('نوع المناسبة')),
                  for (final occ in occasionTypeBuckets)
                    ListTile(
                      title: Text(occ.displayLabel),
                      subtitle: occ.count > 0 ? Text('${occ.count}') : null,
                      trailing: _query.occasionTypeIds.contains(occ.id) ? const Icon(Icons.check) : null,
                      onTap: () => Navigator.pop(context, 'occasionType:${occ.id}'),
                    ),
                ],
                if (_allowFilter('occasionServiceOffer') || occasionOfferBuckets.isNotEmpty) ...[
                  const ListTile(title: Text('عرض الخدمة')),
                  for (final offer in occasionOfferBuckets)
                    ListTile(
                      title: Text(offer.displayLabel),
                      subtitle: offer.count > 0 ? Text('${offer.count}') : null,
                      trailing: _query.occasionServiceOffers.contains(offer.id) ? const Icon(Icons.check) : null,
                      onTap: () => Navigator.pop(context, 'occasionServiceOffer:${offer.id}'),
                    ),
                ],
                if (beauty || (widget.lane != null && _laneServiceFilters)) ...[
                  const Divider(),
                  if (beauty || _allowFilter('placeMode')) ...[
                    const ListTile(title: Text('مكان تقديم الخدمة')),
                    for (final mode in placeBuckets)
                      ListTile(
                        title: Text(placeLabels[mode.id] ?? mode.displayLabel),
                        subtitle: mode.count > 0 ? Text('${mode.count}') : null,
                        trailing: _query.placeModes.contains(mode.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'place:${mode.id}'),
                      ),
                  ],
                  if ((beauty || _allowFilter('branch')) && _facets.branch.isNotEmpty) ...[
                    const ListTile(title: Text('الفرع')),
                    for (final branch in _facets.branch)
                      ListTile(
                        title: Text(branch.displayLabel),
                        subtitle: branch.count > 0 ? Text('${branch.count}') : null,
                        trailing: _query.branchIds.contains(branch.id) ? const Icon(Icons.check) : null,
                        onTap: () => Navigator.pop(context, 'branch:${branch.id}'),
                      ),
                  ],
                  if (beauty || _allowFilter('availableOn'))
                  ListTile(
                    title: Text(
                      _query.availableOn == null ? 'تاريخ الإتاحة' : 'تاريخ الإتاحة: ${_query.availableOn}',
                    ),
                    trailing: _query.availableOn != null
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () => Navigator.pop(context, 'clearAvailableOn'),
                          )
                        : null,
                    onTap: () => Navigator.pop(context, 'availableOn'),
                  ),
                  if (beauty || _allowFilter('duration'))
                  ListTile(
                    title: Text(_durationRangeLabel()),
                    subtitle: const Text('المدة بالدقائق'),
                    trailing: (_query.durationMin != null || _query.durationMax != null)
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () => Navigator.pop(context, 'clearDuration'),
                          )
                        : null,
                    onTap: () => Navigator.pop(context, 'durationRange'),
                  ),
                  if (beauty || _allowFilter('price'))
                  ListTile(
                    title: Text(_priceRangeLabel()),
                    subtitle: const Text('سعر الخدمة بالريال'),
                    trailing: (_query.priceMinHalalas != null || _query.priceMaxHalalas != null)
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () => Navigator.pop(context, 'clearPrice'),
                          )
                        : null,
                    onTap: () => Navigator.pop(context, 'priceRange'),
                  ),
                ],
                const Divider(),
                ListTile(
                  title: const Text('الترتيب الافتراضي'),
                  subtitle: const Text('حسب نوع العنصر ثم المعرّف'),
                  trailing: _query.sort == 'key' ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.pop(context, 'sort:key'),
                ),
                ListTile(
                  title: const Text('السعر: من الأقل للأعلى'),
                  trailing: _query.sort == 'price_asc' ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.pop(context, 'sort:price_asc'),
                ),
                ListTile(
                  title: const Text('السعر: من الأعلى للأقل'),
                  trailing: _query.sort == 'price_desc' ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.pop(context, 'sort:price_desc'),
                ),
                ListTile(title: const Text('مسح كل الفلاتر'), onTap: () => Navigator.pop(context, 'clear')),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || type == null) return;
    if (type == 'clear') {
      _search.clear();
      _clearEleganceDrill();
      await _reload(DiscoverCatalogQuery(lane: widget.lane, requireVisual: widget.lane != null));
    } else if (type == 'all') {
      _clearEleganceDrill();
      await _reload(_query.copyWith(clearType: true, clearCategory: true, clearSubcategory: true).withoutInapplicableFilters());
    } else if (type == 'nearby') {
      // Device GPS is not wired via a location plugin in this build — fall back to explicit city center.
      // Label must never claim the city midpoint is the customer's live location.
      final picked = await _pickSaudiCity(
        context,
        title: 'نقطة بحث للأقرب',
        subtitle:
            'تعذّر استخدام موقع الجهاز أو رُفض الإذن — اختاري مدينة كنقطة مركز صريحة. سيُعرض الترتيب كـ«الأقرب إلى مركز المدينة المحددة».',
      );
      if (!mounted || picked == null) return;
      _nearSourceLabelAr = 'الأقرب إلى مركز المدينة المحددة (${picked.nameAr})';
      await _reload(
        _query
            .copyWith(
              city: picked.id,
              nearLat: picked.lat,
              nearLng: picked.lng,
              sort: 'distance',
            )
            .withoutInapplicableFilters(),
      );
    } else if (type == 'citySearch') {
      final picked = await _pickSaudiCity(
        context,
        title: 'اختاري مدينة',
      );
      if (!mounted || picked == null) return;
      _nearSourceLabelAr = null;
      await _reload(
        _query.copyWith(city: picked.id, clearNear: true, sort: 'key').withoutInapplicableFilters(),
      );
    } else if (type.startsWith('city:')) {
      final city = type.substring(5);
      _nearSourceLabelAr = null;
      await _reload(
        (_query.city == city ? _query.copyWith(clearCity: true) : _query.copyWith(city: city, clearNear: true))
            .withoutInapplicableFilters(),
      );
    } else if (type.startsWith('color:')) {
      final id = type.substring(6);
      final next = [..._query.colors];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(colors: next).withoutInapplicableFilters());
    } else if (type.startsWith('size:')) {
      final id = type.substring(5);
      final next = [..._query.sizes];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(sizes: next).withoutInapplicableFilters());
    } else if (type.startsWith('volume:')) {
      final id = type.substring(7);
      final next = [..._query.volumes];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(volumes: next).withoutInapplicableFilters());
    } else if (type.startsWith('shoeUsage:')) {
      final id = type.substring('shoeUsage:'.length);
      final next = [..._query.shoeUsage];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(shoeUsage: next).withoutInapplicableFilters());
    } else if (type.startsWith('metal:')) {
      final id = type.substring('metal:'.length);
      final next = [..._query.metals];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(metals: next).withoutInapplicableFilters());
    } else if (type.startsWith('purity:')) {
      final id = type.substring('purity:'.length);
      final next = [..._query.purityKarats];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(purityKarats: next).withoutInapplicableFilters());
    } else if (type.startsWith('occasionType:')) {
      final id = type.substring('occasionType:'.length);
      final next = [..._query.occasionTypeIds];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(occasionTypeIds: next).withoutInapplicableFilters());
    } else if (type.startsWith('occasionServiceOffer:')) {
      final id = type.substring('occasionServiceOffer:'.length);
      final next = [..._query.occasionServiceOffers];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(occasionServiceOffers: next).withoutInapplicableFilters());
    } else if (type.startsWith('place:')) {
      final id = type.substring(6);
      final next = [..._query.placeModes];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(placeModes: next).withoutInapplicableFilters());
    } else if (type.startsWith('branch:')) {
      final id = type.substring(7);
      final next = [..._query.branchIds];
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      await _reload(_query.copyWith(branchIds: next).withoutInapplicableFilters());
    } else if (type == 'stock') {
      await _reload(_query.copyWith(
        inStock: _query.inStock == true ? null : true,
        clearInStock: _query.inStock == true,
      ).withoutInapplicableFilters());
    } else if (type == 'clearPrice') {
      await _reload(_query.copyWith(clearPrice: true).withoutInapplicableFilters());
    } else if (type == 'clearDuration') {
      await _reload(_query.copyWith(clearDuration: true).withoutInapplicableFilters());
    } else if (type == 'clearAvailableOn') {
      await _reload(_query.copyWith(clearAvailableOn: true).withoutInapplicableFilters());
    } else if (type == 'priceRange') {
      final range = await _promptIntRange(
        context,
        title: 'نطاق السعر (ريال)',
        minLabel: 'الحد الأدنى',
        maxLabel: 'الحد الأعلى',
        initialMin: _query.priceMinHalalas == null ? null : (_query.priceMinHalalas! / 100).round(),
        initialMax: _query.priceMaxHalalas == null ? null : (_query.priceMaxHalalas! / 100).round(),
      );
      if (!mounted || range == null) return;
      await _reload(
        _query
            .copyWith(
              priceMinHalalas: range.$1 == null ? null : range.$1! * 100,
              priceMaxHalalas: range.$2 == null ? null : range.$2! * 100,
              clearPriceMin: range.$1 == null,
              clearPriceMax: range.$2 == null,
            )
            .withoutInapplicableFilters(),
      );
    } else if (type == 'durationRange') {
      final range = await _promptIntRange(
        context,
        title: 'مدة الخدمة (دقيقة)',
        minLabel: 'الحد الأدنى',
        maxLabel: 'الحد الأعلى',
        initialMin: _query.durationMin,
        initialMax: _query.durationMax,
      );
      if (!mounted || range == null) return;
      await _reload(
        _query
            .copyWith(
              durationMin: range.$1,
              durationMax: range.$2,
              clearDurationMin: range.$1 == null,
              clearDurationMax: range.$2 == null,
            )
            .withoutInapplicableFilters(),
      );
    } else if (type == 'availableOn') {
      final initial = _parseAvailableOn(_query.availableOn) ?? DateTime.now().add(const Duration(days: 1));
      final picked = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime.now(),
        lastDate: DateTime.now().add(const Duration(days: 60)),
        locale: const Locale('ar'),
      );
      if (!mounted || picked == null) return;
      final key =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      await _reload(_query.copyWith(availableOn: key).withoutInapplicableFilters());
    } else if (type.startsWith('sort:')) {
      await _reload(_query.copyWith(sort: type.substring(5)).withoutInapplicableFilters());
    } else {
      await _reload(
        _query
            .copyWith(partnerType: type, clearCategory: true)
            .withoutInapplicableFilters(),
      );
    }
  }

  String _priceRangeLabel() {
    final min = _query.priceMinHalalas;
    final max = _query.priceMaxHalalas;
    if (min == null && max == null) return 'نطاق السعر';
    final minLabel = min == null ? '—' : '${(min / 100).round()}';
    final maxLabel = max == null ? '—' : '${(max / 100).round()}';
    return 'السعر: $minLabel – $maxLabel ر.س';
  }

  String _durationRangeLabel() {
    final min = _query.durationMin;
    final max = _query.durationMax;
    if (min == null && max == null) return 'مدة الخدمة';
    return 'المدة: ${min ?? '—'} – ${max ?? '—'} دقيقة';
  }

  DateTime? _parseAvailableOn(String? raw) {
    if (raw == null || raw.length != 10) return null;
    final parts = raw.split('-');
    if (parts.length != 3) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    final dt = DateTime(y, m, d);
    if (dt.year != y || dt.month != m || dt.day != d) return null;
    return dt;
  }

  Future<(int?, int?)?> _promptIntRange(
    BuildContext context, {
    required String title,
    required String minLabel,
    required String maxLabel,
    int? initialMin,
    int? initialMax,
  }) async {
    final minCtrl = TextEditingController(text: initialMin?.toString() ?? '');
    final maxCtrl = TextEditingController(text: initialMax?.toString() ?? '');
    final result = await showDialog<(int?, int?)>(
      context: context,
      builder: (dialogContext) {
        String? error;
        return StatefulBuilder(
          builder: (context, setLocal) {
            return AlertDialog(
              title: Text(title),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: minCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: minLabel),
                  ),
                  TextField(
                    controller: maxCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: maxLabel),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, (null, null)),
                  child: const Text('مسح'),
                ),
                TextButton(
                  onPressed: () {
                    final minRaw = minCtrl.text.trim();
                    final maxRaw = maxCtrl.text.trim();
                    final minVal = minRaw.isEmpty ? null : int.tryParse(minRaw);
                    final maxVal = maxRaw.isEmpty ? null : int.tryParse(maxRaw);
                    if (minRaw.isNotEmpty && minVal == null) {
                      setLocal(() => error = 'الحد الأدنى غير صالح');
                      return;
                    }
                    if (maxRaw.isNotEmpty && maxVal == null) {
                      setLocal(() => error = 'الحد الأعلى غير صالح');
                      return;
                    }
                    if (minVal != null && minVal < 0) {
                      setLocal(() => error = 'القيم يجب أن تكون صفر أو أكبر');
                      return;
                    }
                    if (maxVal != null && maxVal < 0) {
                      setLocal(() => error = 'القيم يجب أن تكون صفر أو أكبر');
                      return;
                    }
                    if (minVal != null && maxVal != null && minVal > maxVal) {
                      setLocal(() => error = 'الحد الأدنى أكبر من الأعلى');
                      return;
                    }
                    Navigator.pop(dialogContext, (minVal, maxVal));
                  },
                  child: const Text('تطبيق'),
                ),
              ],
            );
          },
        );
      },
    );
    minCtrl.dispose();
    maxCtrl.dispose();
    return result;
  }

  Future<SaudiCity?> _pickSaudiCity(
    BuildContext context, {
    required String title,
    String? subtitle,
  }) async {
    var needle = '';
    return showDialog<SaudiCity>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setLocal) {
            final hits = searchSaudiCities(needle);
            return AlertDialog(
              title: Text(title),
              content: SizedBox(
                width: 360,
                height: 420,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (subtitle != null) ...[
                      Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                    ],
                    TextField(
                      decoration: const InputDecoration(
                        hintText: 'ابحثي باسم المدينة…',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (v) => setLocal(() => needle = v),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: ListView.builder(
                        itemCount: hits.length,
                        itemBuilder: (context, i) {
                          final c = hits[i];
                          return ListTile(
                            title: Text(c.nameAr),
                            subtitle: Text(c.nameEn),
                            onTap: () => Navigator.pop(dialogContext, c),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _openStore(BuildContext context, PresentationSlide slide) async {
    try {
      final repo = widget.gateway is MarketplaceRepositoryImpl ? widget.gateway! as MarketplaceRepositoryImpl : _catalog;
      final load = await repo.partnerDetailLoad(slide.partnerId);
      if (!context.mounted) return;
      if (load == null || load.value.summary.id != slide.partnerId) {
        _tell(context, 'هذه الجهة غير متاحة أو لم تعد منشورة');
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PartnerDetailScreen(partner: load.value.summary, initial: load),
        ),
      );
    } on CatalogSourceException {
      if (context.mounted) _tell(context, 'تعذر فتح صفحة هذه الجهة');
    }
  }

  Future<void> _toggleFavorite(BuildContext context, PresentationSlide slide) async {
    final client = _favorites;
    if (client == null || client.accountKey == null) {
      _tell(context, 'يلزم تسجيل الدخول لحفظ المفضلة');
      return;
    }
    final kind = slide.product != null ? 'product' : 'service';
    if (client.saving(kind, slide.entityId)) return;
    try {
      final saved = await client.toggle(kind: kind, id: slide.entityId);
      if (!context.mounted) return;
      _tell(context, saved ? 'أُضيفت إلى مفضلتك' : 'أُزيلت من مفضلتك');
    } on FavoriteStaleException {
      return;
    } on FavoriteAuthException {
      if (context.mounted) _tell(context, 'يلزم تسجيل الدخول لحفظ المفضلة');
    } on FavoriteMissingException {
      if (context.mounted) _tell(context, 'هذا العنصر غير متاح أو لم يعد منشورًا');
    } on StateError {
      return;
    } catch (_) {
      if (context.mounted) _tell(context, 'تعذر حفظ المفضلة');
    }
  }

  Future<void> _openLocation(BuildContext context, PresentationSlide slide) async {
    if (slide.preview) {
      _tell(context, 'موقع المعاينة ليس موقعك ولا فرعًا حقيقيًا.');
      return;
    }
    _tell(context, 'لا توجد إحداثيات للفرع، لذلك لا تُفتح الخريطة على مركز المدينة.');
  }

  /// Appointment only: never a purchase. Phone contact lives on the detail page.
  /// Intro clinic video uses the same Arabic service picker as service detail.
  Future<void> _contactVenue(BuildContext context, PresentationSlide slide) async {
    if (slide.preview) {
      _tell(context, MarketplaceCopy.previewAppointment);
      return;
    }
    final service = slide.service;
    if (service == null) {
      _tell(context, MarketplaceCopy.appointmentUnavailable);
      return;
    }
    await openServiceBookingFlow(
      context: context,
      service: service,
      bookingDateKey: _query.availableOn,
      bookingBranchId: _query.branchIds.length == 1 ? _query.branchIds.first : null,
      availabilityContext: _availabilityContext,
      discoverLane: widget.lane,
      tell: (m) => _tell(context, m),
    );
  }

  Future<void> _share(BuildContext context, PresentationSlide slide) async {
    try {
      // Dismissing the sheet is not an error and not a completed share, so nothing is claimed.
      await Share.share(discoverShareText(slide));
    } catch (_) {
      if (context.mounted) _tell(context, 'تعذرت المشاركة');
    }
  }

  void _exitPresentation(BuildContext context) {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    } else {
      navigator.pushReplacementNamed(AppRoutes.discover);
    }
  }

  @override
  Widget build(BuildContext context) {
    final laneId = widget.lane?.apiId ?? 'all';
    return Scaffold(
      key: ValueKey('discover_presentation_lane_$laneId'),
      backgroundColor: const Color(0xFF2C2428),
      body: Stack(
              children: [
                // Stable lane identity for tests (empty or filled feed).
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: IgnorePointer(
                    child: Opacity(
                      opacity: 0.01,
                      child: Text(
                        'presentation:$laneId',
                        key: ValueKey('presentation_lane_label_$laneId'),
                      ),
                    ),
                  ),
                ),
                if (_slides.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _catalogDriven
                                ? switch (_phase) {
                                    DiscoverFeedPhase.loading => '',
                                    DiscoverFeedPhase.failed => _loadError ?? 'تعذر تحميل الكتالوج',
                                    _ => widget.lane == null
                                        ? 'لا توجد نتائج. يمكن مسح البحث أو الفلاتر.'
                                        : 'لا توجد عروض بوسائط منشورة في هذا المسار.',
                                  }
                                : 'لا توجد عروض',
                            style: AppTypography.bodyLarge.copyWith(color: Colors.white),
                            textAlign: TextAlign.center,
                          ),
                          if (_catalogDriven && _phase == DiscoverFeedPhase.failed) ...[
                            const SizedBox(height: 12),
                            OutlinedButton(onPressed: () => _feed?.retry(), child: const Text('إعادة المحاولة')),
                          ],
                          if (_catalogDriven) ...[
                            const SizedBox(height: 12),
                            TextButton(onPressed: () {
                              _search.clear();
                              _clearEleganceDrill();
                              _reload(DiscoverCatalogQuery(lane: widget.lane, requireVisual: widget.lane != null));
                            }, child: const Text('مسح البحث والفلاتر')),
                          ],
                        ],
                      ),
                    ),
                  )
                else
                PageView.builder(
              controller: _vertical,
              scrollDirection: Axis.vertical,
              itemCount: _slides.length,
              onPageChanged: _onPage,
              itemBuilder: (context, index) {
                  return _PresentationPage(
                  key: ValueKey('${_slides[index].slotId}:${_slides[index].media.map((item) => item.assetPath).join('|')}'),
                  slide: _slides[index],
                  recordAdLink: widget.recordAdLink ?? _catalog.recordAdLinkOpen,
                  linkOutbox: widget.linkOutbox ?? AdLinkOpenOutbox.shared,
                  confirmAdLink: widget.confirmAdLink ?? _catalog.confirmAdLink,
                  openExternal: widget.openExternal,
                  commerce: _commerce,
                  active: index == _page,
                  playable: _playable && index == _page,
                  epoch: _epoch,
                  video: _video,
                  records: _catalogDriven ? (widget.gateway ?? _catalog) : null,
                  source: _transport,
                  onExit: () => _exitPresentation(context),
                  catalog: _catalogDriven
                      ? _CatalogHooks(
                          search: _search,
                          categoryIndex: _categoryIndexFor(_slides[index]),
                          onSearch: (value) => _reload(_query.copyWith(text: value)),
                          onCategory: _onCategory,
                          onFilter: () => _openFilters(context),
                          onStore: () => _openStore(context, _slides[index]),
                          onAppointment: () => _contactVenue(context, _slides[index]),
                          onLocation: () => _openLocation(context, _slides[index]),
                          onFavorite: () => _toggleFavorite(context, _slides[index]),
                          favoriteSaved: _favorites?.saved(
                                _slides[index].product != null ? 'product' : 'service',
                                _slides[index].entityId,
                              ) ??
                              false,
                          searchFieldKey: index == _page ? _searchFieldKey : null,
                          searchFocus: index == _page ? _searchFocus : null,
                          onShare: () => _share(context, _slides[index]),
                          provenance: null,
                          categoryLabels: widget.lane == null
                              ? null
                              : _railDefs().map((item) => item.label).toList(),
                          categoryAssetFamily: widget.lane?.assetFamily,
                          searchHint: switch (widget.lane) {
                            DiscoverLane.beauty => 'ابحثي عن عيادة أو مشغل أو خدمة',
                            DiscoverLane.elegance ||
                            DiscoverLane.jewelry ||
                            DiscoverLane.children ||
                            DiscoverLane.gifts =>
                              'ابحثي عن منتج أو علامة',
                            DiscoverLane.occasions => 'ابحثي عن منتج أو تنسيق',
                            null => null,
                          },
                          appointmentLabel: 'احجزي موعدًا',
                          showPurchaseLink: _slides[index].product != null || (_slides[index].advertisement?.openLink ?? false),
                          showAppointmentRequest: _slides[index].service != null &&
                              _slides[index].product == null &&
                              (_slides[index].advertisement == null || _slides[index].advertisement!.appointmentOperational),
                          includeSearch: false,
                        )
                      : null,
                );
              },
            ),
                // E3: keep taxonomy rail visible even while the visual feed is empty
                // so definitionsVersion / label bumps remain on-screen and tappable.
                if (_catalogDriven)
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: MediaQuery.paddingOf(context).bottom + 8,
                    child: DiscoverCategoryRail(
                      labels: _railDefs().map((item) => item.label).toList(),
                      ids: _railDefs().map((item) => item.id).toList(),
                      imageKeys: _railDefs().map((item) => item.imageKey).toList(),
                      iconUrls: _railDefs().map((item) => item.iconSmallUrl).toList(),
                      assetFamily: widget.lane?.assetFamily ?? _activeFamily(),
                      selected: _category,
                      onSelected: _onCategory,
                    ),
                  ),
                if (_catalogDriven)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + 4,
                    left: 4,
                    right: 4,
                    child: _CatalogTopChrome(
                      searchOpen: _searchOpen,
                      search: _search,
                      searchFieldKey: _searchFieldKey,
                      searchFocus: _searchFocus,
                      searchHint: switch (widget.lane) {
                        DiscoverLane.beauty => 'ابحثي عن عيادة أو مشغل أو خدمة',
                        DiscoverLane.elegance ||
                        DiscoverLane.jewelry ||
                        DiscoverLane.children ||
                        DiscoverLane.gifts =>
                          'ابحثي عن منتج أو علامة',
                        DiscoverLane.occasions => 'ابحثي عن منتج أو تنسيق',
                        null => 'ابحثي في العروض',
                      },
                      preview: _slides.isNotEmpty && _slides[_page.clamp(0, _slides.length - 1)].preview,
                      showMute: _slides.isNotEmpty &&
                          _slides[_page.clamp(0, _slides.length - 1)].media.any((m) => m.kind == PresentationMediaKind.video),
                      muted: _video.isMuted,
                      onBack: () => _exitPresentation(context),
                      onMute: () async {
                        await _video.setMuted(!_video.isMuted);
                        if (mounted) setState(() {});
                      },
                      onOpenSearch: () {
                        setState(() => _searchOpen = true);
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) _searchFocus.requestFocus();
                        });
                      },
                      onCloseSearch: () {
                        setState(() => _searchOpen = false);
                        _searchFocus.unfocus();
                      },
                      onSearch: (value) => _reload(_query.copyWith(text: value)),
                      onFilter: () => _openFilters(context),
                    ),
                  )
                else if (_slides.isEmpty)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + 8,
                    left: 12,
                    child: IconButton(
                      onPressed: () => _exitPresentation(context),
                      icon: const Icon(Icons.close, color: Colors.white),
                    ),
                  ),
                if (_adsFailed)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + (_catalogDriven ? (_searchOpen ? 72 : 52) : 8),
                    left: 16,
                    right: 16,
                    child: Material(
                      color: AppColors.surface,
                      child: const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text('تعذر تحميل الإعلانات. لم يُعرض إعلان بديل.'),
                      ),
                    ),
                  ),
                if (_favorites?.readFailed == true)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + 108,
                    left: 16,
                    right: 16,
                    child: Material(
                      color: AppColors.surface,
                      child: Row(
                        children: [
                          const Expanded(child: Text('تعذر قراءة المفضلة')),
                          TextButton(
                            onPressed: () => _favorites?.refresh(),
                            child: const Text('إعادة قراءة المفضلة'),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_loadMoreError != null)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 24,
                    child: Material(
                      color: AppColors.surface,
                      child: Row(
                        children: [
                          Expanded(child: Text(_loadMoreError!, style: AppTypography.bodySmall)),
                          TextButton(onPressed: () => _feed?.retryMore(), child: const Text('إعادة المحاولة')),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _CatalogHooks {
  const _CatalogHooks({
    required this.search,
    required this.categoryIndex,
    required this.onSearch,
    required this.onCategory,
    required this.onFilter,
    required this.onStore,
    required this.onAppointment,
    required this.onLocation,
    required this.onFavorite,
    required this.favoriteSaved,
    this.searchFieldKey,
    this.searchFocus,
    required this.onShare,
    required this.provenance,
    this.categoryLabels,
    this.categoryAssetFamily,
    this.searchHint,
    this.appointmentLabel = 'اطلبي موعدًا',
    this.showPurchaseLink = true,
    this.showAppointmentRequest = true,
    this.includeSearch = true,
  });

  final TextEditingController search;
  final int categoryIndex;
  final ValueChanged<String> onSearch;
  final ValueChanged<int> onCategory;
  final VoidCallback onFilter;
  final VoidCallback onStore;
  final VoidCallback onAppointment;
  final VoidCallback onLocation;
  final VoidCallback onFavorite;
  final bool favoriteSaved;
  final Key? searchFieldKey;
  final FocusNode? searchFocus;
  final VoidCallback onShare;
  final String? provenance;
  final List<String>? categoryLabels;
  final String? categoryAssetFamily;
  final String? searchHint;
  final String appointmentLabel;
  final bool showPurchaseLink;
  final bool showAppointmentRequest;
  final bool includeSearch;
}

class _CatalogTopChrome extends StatelessWidget {
  const _CatalogTopChrome({
    required this.searchOpen,
    required this.search,
    required this.searchFieldKey,
    required this.searchFocus,
    required this.searchHint,
    required this.preview,
    required this.showMute,
    required this.muted,
    required this.onBack,
    required this.onMute,
    required this.onOpenSearch,
    required this.onCloseSearch,
    required this.onSearch,
    required this.onFilter,
  });

  final bool searchOpen;
  final TextEditingController search;
  final Key searchFieldKey;
  final FocusNode searchFocus;
  final String searchHint;
  final bool preview;
  final bool showMute;
  final bool muted;
  final VoidCallback onBack;
  final VoidCallback onMute;
  final VoidCallback onOpenSearch;
  final VoidCallback onCloseSearch;
  final ValueChanged<String> onSearch;
  final VoidCallback onFilter;

  @override
  Widget build(BuildContext context) {
    final iconShadow = const [Shadow(blurRadius: 6, color: Colors.black54)];
    Widget chromeIcon(IconData icon, VoidCallback onTap, String label) {
      return IconButton(
        onPressed: onTap,
        tooltip: label,
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsets.all(8),
        constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
        icon: Icon(icon, color: Colors.white, size: 24, shadows: iconShadow),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (searchOpen)
          Row(
            children: [
              chromeIcon(Icons.close, onCloseSearch, 'إغلاق البحث'),
              Expanded(
                child: DiscoverSearchField(
                  hint: searchHint,
                  fieldKey: searchFieldKey,
                  focusNode: searchFocus,
                  controller: search,
                  onSearch: onSearch,
                  onTap: () {},
                ),
              ),
            ],
          )
        else
          SizedBox(
            height: 44,
            child: Row(
              children: [
                chromeIcon(Icons.chevron_right, onBack, 'رجوع'),
                if (showMute) chromeIcon(muted ? Icons.volume_off : Icons.volume_up, onMute, muted ? 'تشغيل الصوت' : 'كتم الصوت'),
                const Spacer(),
                Image.asset(
                  'assets/images/mira_logo_icon.png',
                  height: 28,
                  errorBuilder: (_, __, ___) => Text(
                    'MIRA',
                    style: AppTypography.titleMedium.copyWith(color: Colors.white, letterSpacing: 1.6, shadows: iconShadow),
                  ),
                ),
                const Spacer(),
                chromeIcon(Icons.search, onOpenSearch, 'بحث'),
                chromeIcon(Icons.tune, onFilter, 'الفلاتر'),
              ],
            ),
          ),
        if (preview)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Padding(
              padding: const EdgeInsets.only(top: 2, right: 12),
              child: Text(
                'معاينة تجريبية',
                style: AppTypography.labelSmall.copyWith(color: Colors.white.withValues(alpha: 0.92)),
              ),
            ),
          ),
      ],
    );
  }
}

class _PresentationPage extends StatefulWidget {
  const _PresentationPage({
    super.key,
    required this.slide,
    required this.active,
    required this.playable,
    required this.epoch,
    required this.video,
    required this.onExit,
    this.catalog,
    this.records,
    this.source,
    this.recordAdLink,
    this.confirmAdLink,
    this.openExternal,
    this.commerce,
    required this.linkOutbox,
  });

  final CommerceClient? commerce;
  final PresentationSlide slide;
  final bool active;
  final _CatalogHooks? catalog;
  final DiscoverCatalogGateway? records;
  final CatalogTransport? source;
  final bool playable;
  final int epoch;
  final PresentationVideoPort video;
  final VoidCallback onExit;
  final AdLinkSender? recordAdLink;
  final AdLinkOpenOutbox linkOutbox;
  final Future<bool> Function({required String adId, required String url})? confirmAdLink;
  final Future<bool> Function(Uri uri)? openExternal;

  @override
  State<_PresentationPage> createState() => _PresentationPageState();
}

class _PresentationPageState extends State<_PresentationPage> {
  late final PageController _horizontal;
  int _media = 0;
  int _category = 0;
  PresentationSlot? _held;
  bool _linkBusy = false;
  bool _cartBusy = false;

  @override
  void initState() {
    super.initState();
    _horizontal = PageController();
    _syncVideo();
  }

  @override
  void didUpdateWidget(covariant _PresentationPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.playable != widget.playable || oldWidget.epoch != widget.epoch || oldWidget.active != widget.active) {
      _syncVideo();
    }
    if (oldWidget.active && !widget.active) {
      ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    }
    if (oldWidget.slide.slotId != widget.slide.slotId) {
      _media = 0;
      _category = 0;
      if (_horizontal.hasClients) {
        _horizontal.jumpToPage(0);
      }
    }
  }

  @override
  void dispose() {
    final held = _held;
    _held = null;
    if (held != null) widget.video.detach(held);
    _horizontal.dispose();
    super.dispose();
  }

  void _syncVideo() {
    if (widget.slide.media.isEmpty) {
      _releaseHeld();
      return;
    }
    final media = widget.slide.media[_media];
    final slot = PresentationSlot(widget.slide.slotId, _media);
    if (!widget.playable || media.kind != PresentationMediaKind.video) {
      _releaseHeld();
      return;
    }
    if (_held != null && !_held!.same(slot)) {
      widget.video.detach(_held!);
    }
    _held = slot;
    widget.video.attach(slot, media.assetPath);
  }

  void _releaseHeld() {
    final held = _held;
    _held = null;
    if (held != null) widget.video.detach(held);
  }

  @override
  Widget build(BuildContext context) {
    final slide = widget.slide;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (slide.media.isEmpty)
          Center(
            child: Text(
              'لا توجد وسائط منشورة لهذا العرض',
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
          )
        else
          PageView.builder(
            controller: _horizontal,
            itemCount: slide.media.length,
            onPageChanged: (index) {
              setState(() => _media = index);
              _syncVideo();
            },
            itemBuilder: (context, index) {
              return _MediaFrame(
                media: slide.media[index],
                slot: PresentationSlot(slide.slotId, index),
                video: widget.video,
                coverPath: slide.mainOfferKind == CatalogMainOfferKind.video ? slide.videoCoverPath : null,
              );
            },
          ),
        DiscoverVisualChrome(
          slide: slide,
          mediaCount: slide.media.length,
          mediaIndex: _media,
          showMute: slide.media.isNotEmpty && slide.media[_media].kind == PresentationMediaKind.video,
          muted: widget.video.isMuted,
          onBack: widget.onExit,
          onDetails: () => _openDetails(context),
          onMute: () async {
            await widget.video.setMuted(!widget.video.isMuted);
            if (mounted) setState(() {});
          },
          onBuy: () => _buy(context),
          selectedCategory: widget.catalog?.categoryIndex ?? _category,
          onCategory: widget.catalog?.onCategory ?? (index) => setState(() => _category = index),
          searchController: widget.catalog?.search,
          searchFieldKey: widget.catalog?.searchFieldKey,
          searchFocus: widget.catalog?.searchFocus,
          onSearch: widget.catalog?.onSearch,
          favoriteSaved: widget.catalog?.favoriteSaved ?? false,
          onStore: widget.catalog?.onStore,
          onAppointment: widget.catalog?.onAppointment,
          onLocation: widget.catalog?.onLocation,
          onFavorite: widget.catalog?.onFavorite,
          onShare: widget.catalog?.onShare,
          onFilter: widget.catalog?.onFilter,
          includeSearch: widget.catalog?.includeSearch ?? true,
          provenance: null,
          showCategoryRail: widget.catalog == null,
          bottomReserve: widget.catalog == null ? 0 : 138,
          categoryLabels: widget.catalog?.categoryLabels,
          categoryAssetFamily: widget.catalog?.categoryAssetFamily,
          searchHintText: widget.catalog?.searchHint,
          appointmentLabel: widget.catalog?.appointmentLabel ?? 'احجزي موعدًا',
          viewCount: DiscoverViewSnapshot.disabled(
            targetKind: slide.advertisement == null ? (slide.product != null ? 'product' : 'service') : 'ad',
            targetId: slide.advertisement?.id ?? slide.entityId,
          ),
          advertisementLabel: slide.advertisement?.disclosureLine,
          showPurchaseLink: widget.catalog?.showPurchaseLink ??
              ((slide.product != null || slide.service == null) &&
                  (slide.advertisement == null || slide.advertisement!.openLink || slide.product != null)),
          showAppointmentRequest: widget.catalog?.showAppointmentRequest ??
              (slide.service != null && slide.product == null && (slide.advertisement == null || slide.advertisement!.appointmentOperational)),
          purchaseLabel: slide.advertisement != null
              ? 'افتحي الرابط'
              : (slide.product?.outOfStock == true ? 'غير متوفر' : MarketplaceCopy.addToCart),
          onUnavailable: (message) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
          },
        ),
      ],
    );
  }

  bool _stillShowing(String adId) => widget.active && widget.slide.advertisement?.id == adId;

  Future<void> _openAdLink(BuildContext context, void Function(String message) tell, DiscoverAdLink ad) async {
    final adId = ad.id;
    if (!ad.openLink) {
      tell('لا يوجد رابط صالح لهذا الإعلان');
      return;
    }
    final url = widget.slide.product?.externalUrl.trim() ?? '';
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      tell('لا يوجد رابط صالح لهذا الإعلان');
      return;
    }
    final confirm = widget.confirmAdLink;
    if (confirm != null) {
      final eligible = await confirm(adId: adId, url: url);
      if (!context.mounted || !_stillShowing(adId)) return;
      if (!eligible) {
        tell('الإعلان غير متاح');
        return;
      }
    }
    final recorder = widget.recordAdLink;
    if (recorder == null) {
      if (context.mounted && _stillShowing(adId)) tell('تعذر تسجيل فتح الرابط');
      return;
    }
    final opener = widget.openExternal ?? (target) => MiraUrlLauncher.openExternal(context, target.toString());
    bool opened;
    try {
      opened = await opener(uri);
    } catch (_) {
      if (!context.mounted || !_stillShowing(adId)) return;
      tell('تعذر فتح الرابط. هذا ليس شراءً مكتملًا');
      return;
    }
    if (!opened) {
      if (context.mounted && _stillShowing(adId)) tell('تعذر فتح الرابط. هذا ليس شراءً مكتملًا');
      return;
    }
    final eventId = newAdLinkEventId();
    widget.linkOutbox.enqueue(adId: adId, eventId: eventId, send: recorder);
    if (context.mounted && _stillShowing(adId)) {
      tell('فُتح رابط خارجي. هذا ليس شراءً مكتملًا');
    }
  }

  Future<void> _buy(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    void tell(String message) {
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }

    final ad = widget.slide.advertisement;
    if (ad != null) {
      if (_linkBusy) return;
      _linkBusy = true;
      try {
        await _openAdLink(context, tell, ad);
      } finally {
        _linkBusy = false;
      }
      return;
    }
    final product = widget.slide.product;
    switch (decideBuyRoute(product: product, preview: widget.slide.preview)) {
      case BuyRoute.preview:
        tell(MarketplaceCopy.previewBuy);
      case BuyRoute.outOfStock:
        tell(MarketplaceCopy.outOfStock);
      case BuyRoute.unavailable:
        tell('الطلب داخل ميرا غير متاح لهذا المنتج الآن.');
      case BuyRoute.none:
        tell('لا يوجد رابط شراء صالح');
      case BuyRoute.inApp:
        if (_cartBusy) return;
        _cartBusy = true;
        try {
          var selected = Map<String, String>.from(widget.slide.matchedVariantSelections);
          if (product!.optionGroups.isNotEmpty) {
            final matchedIds = widget.slide.matchedVariantIds;
            final needsPick = selected.isEmpty ||
                matchedIds.length > 1 ||
                CatalogOptionJson.firstMissing(groups: product.optionGroups, selected: selected) != null;
            if (needsPick) {
              final picked = await _pickOptions(
                context,
                product,
                initialSelected: selected,
                // null = unrestricted browse; non-null (even empty) = match scope from filters.
                allowedVariantIds: matchedIds.isEmpty ? null : matchedIds,
              );
              if (picked == null || !context.mounted) return;
              selected = picked;
            }
          }
          await CommerceCartActions.addToCart(
            context,
            client: widget.commerce ?? ApiCommerceClient(),
            product: product,
            selected: selected,
          );
        } finally {
          _cartBusy = false;
        }
      case BuyRoute.external:
        final opened = await MiraUrlLauncher.openExternal(context, product!.externalUrl.trim());
        if (!context.mounted || !opened) return;
        tell('فُتح رابط خارجي. هذا ليس شراءً مكتملًا');
    }
  }

  Future<Map<String, String>?> _pickOptions(
    BuildContext context,
    CatalogProduct product, {
    Map<String, String> initialSelected = const {},
    List<String>? allowedVariantIds,
  }) {
    return showModalBottomSheet<Map<String, String>>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) => _DiscoverOptionSheet(
        product: product,
        initialSelected: initialSelected,
        allowedVariantIds: allowedVariantIds,
      ),
    );
  }

  void _openDetails(BuildContext context) {
    final kind = widget.slide.product != null ? 'product' : 'service';
    final initial = widget.slide.matchedVariantSelections;
    final matchedIds = widget.slide.matchedVariantIds;
    final parent = context.findAncestorStateOfType<DiscoverPresentationScreenState>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CatalogRecordScope.page(
          kind: kind,
          id: widget.slide.entityId,
          transport: widget.source ?? CatalogTransport.localCatalog,
          gateway: widget.records,
          initialSelections: matchedIds.length == 1 && initial.isNotEmpty ? initial : null,
          matchedVariantIds: matchedIds.isEmpty ? null : matchedIds,
          bookingDateKey: parent?._query.availableOn,
          bookingBranchId: parent != null && parent._query.branchIds.length == 1
              ? parent._query.branchIds.first
              : null,
          availabilityContext: parent?._availabilityContext,
          discoverLane: parent?.widget.lane,
        ),
      ),
    );
  }
}

class _DiscoverOptionSheet extends StatefulWidget {
  const _DiscoverOptionSheet({
    required this.product,
    this.initialSelected = const {},
    /// null = no match restriction; empty = matches were required but none remain.
    this.allowedVariantIds,
  });

  final CatalogProduct product;
  final Map<String, String> initialSelected;
  final List<String>? allowedVariantIds;

  @override
  State<_DiscoverOptionSheet> createState() => _DiscoverOptionSheetState();
}

class _DiscoverOptionSheetState extends State<_DiscoverOptionSheet> {
  late Map<String, String> _selected = Map<String, String>.from(widget.initialSelected);

  bool get _matchScopeActive => DiscoverMatchScope.isActive(widget.allowedVariantIds);

  bool get _matchesGone => DiscoverMatchScope.matchesGone(
        matchedVariantIds: widget.allowedVariantIds,
        variantIds: widget.product.variants.map((v) => v.id),
      );

  List<CatalogProductVariant> get _variants => DiscoverMatchScope.filterVariants(
        matchedVariantIds: widget.allowedVariantIds,
        variants: widget.product.variants,
        idOf: (v) => v.id,
      );

  CatalogProduct get _scopedProduct {
    final variants = _variants;
    if (!_matchScopeActive || identical(variants, widget.product.variants)) return widget.product;
    return CatalogProduct(
      id: widget.product.id,
      partnerId: widget.product.partnerId,
      partnerNameAr: widget.product.partnerNameAr,
      partnerEmoji: widget.product.partnerEmoji,
      nameAr: widget.product.nameAr,
      nameEn: widget.product.nameEn,
      descriptionAr: widget.product.descriptionAr,
      priceHalalas: widget.product.priceHalalas,
      priceLabel: widget.product.priceLabel,
      priceKnown: widget.product.priceKnown,
      externalUrl: widget.product.externalUrl,
      stepAr: widget.product.stepAr,
      contactPhone: widget.product.contactPhone,
      matchScore: widget.product.matchScore,
      matchKnown: widget.product.matchKnown,
      category: widget.product.category,
      concernTags: widget.product.concernTags,
      media: widget.product.media,
      mainOfferKind: widget.product.mainOfferKind,
      optionGroups: widget.product.optionGroups,
      variants: variants,
      traits: widget.product.traits,
      purchaseMode: widget.product.purchaseMode,
      stockQty: widget.product.stockQty,
      deliveryFeeHalalas: widget.product.deliveryFeeHalalas,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_matchesGone) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('التركيبات المطابقة لبحثك لم تعد متاحة', style: AppTypography.titleMedium),
              const SizedBox(height: 8),
              Text(
                'حدّثي نتائج الاكتشاف أو أعيدي اختيار الفلاتر، ثم حاولي مجددًا.',
                style: AppTypography.bodyMedium,
              ),
              const SizedBox(height: 12),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                onPressed: () => Navigator.pop(context),
                child: const Text('حسناً'),
              ),
            ],
          ),
        ),
      );
    }
    final missing = CatalogOptionJson.firstMissing(groups: widget.product.optionGroups, selected: _selected);
    final multi = (widget.allowedVariantIds?.length ?? 0) > 1;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(multi ? 'اختاري من النتائج المطابقة' : 'اختاري الخيارات', style: AppTypography.titleMedium),
            const SizedBox(height: 12),
            ProductOptionSelector(
              product: _scopedProduct,
              initialSelected: widget.initialSelected,
              onChanged: (selected, _) => setState(() => _selected = selected),
            ),
            const SizedBox(height: 12),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
              onPressed: missing == null ? () => Navigator.pop(context, _selected) : null,
              child: Text(missing == null ? MarketplaceCopy.addToCart : MarketplaceCopy.chooseOption(missing.labelAr)),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaFrame extends StatefulWidget {
  const _MediaFrame({
    required this.media,
    required this.slot,
    required this.video,
    this.coverPath,
  });

  final PresentationMedia media;
  final PresentationSlot slot;
  final PresentationVideoPort video;
  final String? coverPath;

  @override
  State<_MediaFrame> createState() => _MediaFrameState();
}

class _MediaFrameState extends State<_MediaFrame> {
  @override
  void initState() {
    super.initState();
    widget.video.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(covariant _MediaFrame oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video != widget.video) {
      oldWidget.video.removeListener(_rebuild);
      widget.video.addListener(_rebuild);
    }
  }

  @override
  void dispose() {
    widget.video.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    final media = widget.media;
    final slot = widget.slot;
    if (media.kind == PresentationMediaKind.video) {
      final owns = video.activeSlot != null && video.activeSlot!.same(slot);
      final view = owns ? video.buildView() : null;
      final cover = widget.coverPath;
      final failed = owns && video.playback == PresentationPlayback.failed;
      return ColoredBox(
        color: const Color(0xFF111111),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (cover != null && view == null) DiscoverSceneCover(path: cover),
            if (view != null) Positioned.fill(child: view),
            if (failed)
              _Failure(
                message: video.errorText ?? 'تعذر تشغيل الفيديو',
                onRetry: () => video.retry(slot, media.assetPath),
              ),
          ],
        ),
      );
    }
    return DiscoverSceneStill(key: ValueKey(media.assetPath), media: media);
  }
}

class _Failure extends StatelessWidget {
  const _Failure({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0x66111111),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, style: AppTypography.bodyMedium.copyWith(color: Colors.white)),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}

/// Share text for one slide. Preview slides are not real records, so they carry no link.
String discoverShareText(PresentationSlide slide) {
  final lines = <String>[slide.title, slide.partnerName];
  if (!slide.preview && slide.advertisement == null && slide.entityId.isNotEmpty) {
    final kind = slide.product != null ? 'product' : 'service';
    lines.add('${MiraPublicUrls.siteBase}/discover/$kind/${Uri.encodeComponent(slide.entityId)}');
  }
  return lines.join('\n');
}
