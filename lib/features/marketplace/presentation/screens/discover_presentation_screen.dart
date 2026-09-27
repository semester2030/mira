import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/mira_route_observer.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/catalog_provenance.dart';
import '../../data/discover_catalog_gateway.dart';
import '../../data/catalog_record_scope.dart';
import '../../data/discover_favorite_client.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/discover_published_ad.dart';
import '../presentation/discover_ad.dart';
import '../presentation/presentation_models.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../data/ad_link_record.dart';
import '../ad_link_open_outbox.dart';
import '../discover_browse_sequence.dart';
import '../discover_feed_controller.dart';
import '../presentation/discover_presentation_catalog.dart';
import '../presentation/discover_view_count.dart';
import '../presentation/discover_visual_chrome.dart';
import '../presentation/presentation_video_port.dart';
import 'catalog_record_page.dart';
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

  @override
  State<DiscoverPresentationScreen> createState() => _DiscoverPresentationScreenState();
}

class _DiscoverPresentationScreenState extends State<DiscoverPresentationScreen>
    with WidgetsBindingObserver, RouteAware {
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
  final _search = TextEditingController();
  final _searchFieldKey = GlobalKey();
  final _searchFocus = FocusNode();
  DiscoverFavoriteClient? _favorites;
  var _ownsFavorites = false;
  DiscoverCatalogQuery _query = const DiscoverCatalogQuery();
  String? _nextCursor;
  List<String> _cities = const [];
  CatalogTransport? _transport;
  ContentMark? _contentMark;
  int _category = 0;
  DiscoverFeedController? _feed;
  DiscoverFeedPhase _phase = DiscoverFeedPhase.ready;
  String? _loadError;
  String? _loadMoreError;
  String? _adsNote;
  int _replacement = 0;

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
        _adsNote = next.adsFailed ? 'تعذر تحميل الإعلانات. لم يُعرض إعلان بديل.' : null;
        _nextCursor = next.nextCursor;
        _cities = next.cities;
        _transport = next.transport;
        _contentMark = next.contentMark;
        _loadError = next.loadError;
        _loadMoreError = next.loadMoreError;
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
      if (_vertical.hasClients && (_vertical.page?.round() ?? 0) != _page) {
        _vertical.jumpToPage(_page);
      }
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
    if (_catalogDriven && _nextCursor != null && index >= _slides.length - 1) {
      _feed?.loadMore();
    }
  }

  Future<void> _reload(DiscoverCatalogQuery query) => _feed?.load(query) ?? Future.value();

  int _categoryIndexFor(PresentationSlide slide) {
    final items = DiscoverCatalogQueryEngine.forFamily(widget.lane == null ? _familyOf(slide) : _activeFamily());
    final sameContext = widget.lane != null || _query.partnerType == null || _query.partnerType == _familyType(slide);
    final id = sameContext ? (_query.categoryId ?? 'all') : 'all';
    final index = items.indexWhere((item) => item.id == id);
    return index < 0 ? 0 : index;
  }

  int _categoryIndex(DiscoverCatalogQuery query) {
    final items = DiscoverCatalogQueryEngine.forFamily(_queryFamily(query));
    final index = items.indexWhere((item) => item.id == (query.categoryId ?? 'all'));
    return index < 0 ? 0 : index;
  }

  String _queryFamily(DiscoverCatalogQuery query) {
    return switch (query.lane) {
      DiscoverLane.elegance => 'elegance',
      DiscoverLane.beauty => 'beauty',
      null => switch (query.partnerType) {
          'clinic' => 'clinic',
          'salon' => 'salon',
          _ => 'product',
        },
    };
  }

  String _activeFamily() {
    if (widget.lane == DiscoverLane.elegance) return 'elegance';
    if (widget.lane == DiscoverLane.beauty) return 'beauty';
    return _slides.isEmpty ? 'product' : _familyOf(_slides[_page.clamp(0, _slides.length - 1)]);
  }

  bool _canPurchase(PresentationSlide slide) {
    if (slide.advertisement != null) return slide.advertisement!.openLink;
    final url = slide.product?.externalUrl.trim() ?? '';
    final uri = Uri.tryParse(url);
    return slide.product != null && uri != null && uri.hasScheme && uri.host.isNotEmpty;
  }

  String _familyOf(PresentationSlide slide) {
    final type = slide.service?.partnerType;
    if (type == 'clinic') return 'clinic';
    if (type == 'salon') return 'salon';
    return 'product';
  }

  void _onCategory(int index) {
    final family = _activeFamily();
    final items = DiscoverCatalogQueryEngine.forFamily(family);
    if (index < 0 || index >= items.length) return;
    final selected = items[index];
    if (widget.lane != null) {
      _reload(
        _query.copyWith(
          lane: widget.lane,
          requireVisual: true,
          categoryId: selected.matchesAll ? null : selected.id,
          clearCategory: selected.matchesAll,
          clearType: true,
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

  Future<void> _openFilters(BuildContext context) async {
    final type = await showModalBottomSheet<String>(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.lane == null) ...[
                ListTile(title: const Text('كل الأنواع'), onTap: () => Navigator.pop(context, 'all')),
                ListTile(title: const Text('منتجات'), onTap: () => Navigator.pop(context, 'brand')),
                ListTile(title: const Text('عيادات'), onTap: () => Navigator.pop(context, 'clinic')),
                ListTile(title: const Text('مشاغل'), onTap: () => Navigator.pop(context, 'salon')),
              ],
              for (final city in _cities)
                ListTile(title: Text(city), onTap: () => Navigator.pop(context, 'city:$city')),
              ListTile(title: const Text('مسح الفلاتر'), onTap: () => Navigator.pop(context, 'clear')),
            ],
          ),
        );
      },
    );
    if (!mounted || type == null) return;
    if (type == 'clear') {
      _search.clear();
      await _reload(DiscoverCatalogQuery(lane: widget.lane, requireVisual: widget.lane != null));
    } else if (type == 'all') {
      await _reload(_query.copyWith(clearType: true, clearCategory: true));
    } else if (type.startsWith('city:')) {
      await _reload(_query.copyWith(city: type.substring(5)));
    } else {
      await _reload(_query.copyWith(partnerType: type, clearCategory: true));
    }
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
      if (context.mounted) _tell(context, 'تعذر تحميل متجر هذه الجهة');
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
    _tell(context, 'لا توجد إحداثيات للفرع، لذلك لا تُفتح الخريطة على مركز المدينة.');
  }

  Future<void> _contactVenue(BuildContext context, PresentationSlide slide) async {
    final phone = slide.service?.contactPhone?.trim();
    if (phone == null || phone.isEmpty) {
      _tell(context, 'لا توجد وسيلة تواصل مسجّلة. هذا ليس حجزًا مؤكدًا.');
      return;
    }
    final opened = await MiraUrlLauncher.openExternal(context, 'tel:$phone');
    if (!context.mounted || !opened) return;
    _tell(context, 'فُتح الاتصال بالجهة. هذا ليس حجزًا مؤكدًا.');
  }

  Future<void> _share(BuildContext context, PresentationSlide slide) async {
    final url = slide.product?.externalUrl.trim();
    final lines = <String>[slide.title, slide.partnerName];
    if (url != null && url.isNotEmpty) lines.add(url);
    try {
      await Share.share(lines.join('\n'));
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
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
              children: [
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
                                    DiscoverFeedPhase.loading => 'جاري تحميل الكتالوج',
                                    DiscoverFeedPhase.failed => _loadError ?? 'تعذر تحميل الكتالوج',
                                    _ => widget.lane == null
                                        ? 'لا توجد نتائج. يمكن مسح البحث أو الفلاتر.'
                                        : 'لا توجد عروض بوسائط منشورة في هذا المسار.',
                                  }
                                : 'لا توجد عروض',
                            style: AppTypography.bodyLarge,
                            textAlign: TextAlign.center,
                          ),
                          if (_adsNote != null) ...[
                            const SizedBox(height: 12),
                            Text(_adsNote!, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
                          ],
                          if (_catalogDriven && _phase == DiscoverFeedPhase.failed) ...[
                            const SizedBox(height: 12),
                            OutlinedButton(onPressed: () => _feed?.retry(), child: const Text('إعادة المحاولة')),
                          ],
                          if (_catalogDriven) ...[
                            const SizedBox(height: 12),
                            TextButton(onPressed: () {
                              _search.clear();
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
                          searchFieldKey: _searchFieldKey,
                          searchFocus: _searchFocus,
                          onShare: () => _share(context, _slides[index]),
                          provenance: null,
                          categoryLabels: widget.lane == null
                              ? null
                              : DiscoverCatalogQueryEngine.forFamily(_activeFamily()).map((item) => item.label).toList(),
                          categoryAssetFamily: switch (widget.lane) {
                            DiscoverLane.elegance => 'elegance',
                            DiscoverLane.beauty => 'beauty',
                            null => null,
                          },
                          searchHint: switch (widget.lane) {
                            DiscoverLane.elegance => 'ابحثي عن منتج أو علامة',
                            DiscoverLane.beauty => 'ابحثي عن عيادة أو مشغل أو خدمة',
                            null => null,
                          },
                          appointmentLabel: 'تواصلي',
                          showPurchaseLink: _canPurchase(_slides[index]),
                          showAppointmentRequest: (_slides[index].service?.contactPhone?.trim().isNotEmpty ?? false),
                        )
                      : null,
                );
              },
            ),
                if (_slides.isEmpty)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + 8,
                    right: 12,
                    left: 12,
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => _exitPresentation(context),
                          icon: const Icon(Icons.close, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                if (_catalogDriven) const SizedBox.shrink(),
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
                if (_adsNote != null && _slides.isNotEmpty)
                  Positioned(
                    top: MediaQuery.paddingOf(context).top + 8,
                    left: 16,
                    right: 16,
                    child: Text(_adsNote!, textAlign: TextAlign.center, style: AppTypography.bodyMedium),
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
    required this.searchFieldKey,
    required this.searchFocus,
    required this.onShare,
    required this.provenance,
    this.categoryLabels,
    this.categoryAssetFamily,
    this.searchHint,
    this.appointmentLabel = 'اطلبي موعدًا',
    this.showPurchaseLink = true,
    this.showAppointmentRequest = true,
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
  final Key searchFieldKey;
  final FocusNode searchFocus;
  final VoidCallback onShare;
  final String? provenance;
  final List<String>? categoryLabels;
  final String? categoryAssetFamily;
  final String? searchHint;
  final String appointmentLabel;
  final bool showPurchaseLink;
  final bool showAppointmentRequest;
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
    required this.linkOutbox,
  });

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
          includeSearch: true,
          provenance: null,
          categoryLabels: widget.catalog?.categoryLabels,
          categoryAssetFamily: widget.catalog?.categoryAssetFamily,
          searchHintText: widget.catalog?.searchHint,
          appointmentLabel: widget.catalog?.appointmentLabel ?? 'اطلبي موعدًا',
          viewCount: DiscoverViewSnapshot.disabled(
            targetKind: slide.advertisement == null ? (slide.product != null ? 'product' : 'service') : 'ad',
            targetId: slide.advertisement?.id ?? slide.entityId,
          ),
          advertisementLabel: slide.advertisement?.disclosureLine,
          showPurchaseLink: widget.catalog?.showPurchaseLink ?? (slide.advertisement == null || slide.advertisement!.openLink),
          showAppointmentRequest: widget.catalog?.showAppointmentRequest ?? (slide.advertisement == null || slide.advertisement!.appointmentOperational),
          purchaseLabel: slide.advertisement == null ? 'اشتري الآن' : 'افتحي الرابط',
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
    if (widget.slide.preview || widget.slide.product == null) {
      tell('هذه معاينة ولا تنفّذ شراءً');
      return;
    }
    final url = widget.slide.product!.externalUrl.trim();
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      tell('لا يوجد رابط شراء صالح');
      return;
    }
    final opened = await MiraUrlLauncher.openExternal(context, url);
    if (!context.mounted || !opened) return;
    tell('فُتح رابط خارجي. هذا ليس شراءً مكتملًا');
  }

  void _openDetails(BuildContext context) {
    if (widget.slide.preview) return;
    final kind = widget.slide.product != null ? 'product' : 'service';
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CatalogRecordScope.page(
          kind: kind,
          id: widget.slide.entityId,
          transport: widget.source ?? CatalogTransport.localCatalog,
          gateway: widget.records,
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
  });

  final PresentationMedia media;
  final PresentationSlot slot;
  final PresentationVideoPort video;

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
      if (owns && video.playback == PresentationPlayback.failed) {
        return _Failure(
          message: video.errorText ?? 'تعذر تشغيل الفيديو',
          onRetry: () => video.retry(slot, media.assetPath),
        );
      }
      final view = owns ? video.buildView() : null;
      return ColoredBox(
        color: AppColors.background,
        child: Center(
          child: view ??
              Text(
                owns && video.playback == PresentationPlayback.loading ? 'جاري تجهيز الفيديو' : '',
                style: AppTypography.bodyMedium,
              ),
        ),
      );
    }
    return _StillImage(media: media);
  }
}

class _StillImage extends StatefulWidget {
  const _StillImage({required this.media});

  final PresentationMedia media;

  @override
  State<_StillImage> createState() => _StillImageState();
}

class _StillImageState extends State<_StillImage> {
  Object? _error;
  var _attempt = 0;

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _Failure(
        message: 'تعذر تحميل الصورة',
        onRetry: () => setState(() {
          _error = null;
          _attempt += 1;
        }),
      );
    }
    final image = widget.media.network
        ? Image.network(
            widget.media.assetPath,
            key: ValueKey('${widget.media.assetPath}-$_attempt'),
            fit: BoxFit.contain,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return Text('جاري تحميل الصورة', style: AppTypography.bodyMedium);
            },
            errorBuilder: (_, error, __) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && _error == null) setState(() => _error = error);
              });
              return const SizedBox.shrink();
            },
          )
        : Image.asset(
            widget.media.assetPath,
            key: ValueKey('${widget.media.assetPath}-$_attempt'),
            fit: BoxFit.contain,
            errorBuilder: (_, error, __) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && _error == null) setState(() => _error = error);
              });
              return const SizedBox.shrink();
            },
          );
    return ColoredBox(
      color: AppColors.background,
      child: Center(child: image),
    );
  }
}

class _Failure extends StatelessWidget {
  const _Failure({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, style: AppTypography.bodyMedium),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
