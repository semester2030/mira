import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../data/catalog_price.dart';
import '../../data/catalog_provenance.dart';
import '../../data/catalog_record_scope.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/partner_detail.dart';
import '../../domain/entities/partner_summary.dart';
import '../booking_basket.dart';
import '../widgets/catalog_detail_media_section.dart';
import '../widgets/marketplace_data_banner.dart';
import '../widgets/matched_product_tile.dart';
import 'booking_basket_screen.dart';

class PartnerDetailScreen extends StatefulWidget {
  final PartnerSummary partner;
  final CatalogLoad<PartnerDetail>? initial;
  final Future<CatalogLoad<PartnerDetail>?> Function(String id)? loadDetail;

  const PartnerDetailScreen({super.key, required this.partner, this.initial, this.loadDetail});

  @override
  State<PartnerDetailScreen> createState() => _PartnerDetailScreenState();
}

class _PartnerDetailScreenState extends State<PartnerDetailScreen> with SingleTickerProviderStateMixin {
  final _repo = MarketplaceRepositoryImpl();
  late Future<CatalogLoad<PartnerDetail>?> _future;
  late final TabController _tabs;
  final _search = TextEditingController();
  String? _categoryFilter;
  final Set<String> _selectedServiceIds = {};

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _future = widget.initial == null
        ? (widget.loadDetail ?? _repo.partnerDetailLoad)(widget.partner.id)
        : Future.value(widget.initial);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogLoad<PartnerDetail>?>(
      future: _future,
      builder: (context, snapshot) {
        final isVenue = widget.partner.isClinic || widget.partner.isSalon || (snapshot.data?.value.services.isNotEmpty ?? false);

        return Scaffold(
          backgroundColor: AppColors.surface,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            surfaceTintColor: Colors.transparent,
            centerTitle: true,
            title: const MirraLogo.appBar(),
            actions: [
              IconButton(
                tooltip: 'حفظ',
                onPressed: () {},
                icon: Icon(Icons.favorite_border, color: AppColors.brandBurgundy),
              ),
              IconButton(
                tooltip: 'مشاركة',
                onPressed: () {},
                icon: Icon(Icons.ios_share_outlined, color: AppColors.brandBurgundy),
              ),
            ],
          ),
          body: Builder(
            builder: (context) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              final load = snapshot.data;
              final detail = load?.value;
              if (load == null || detail == null) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('تعذر تحميل البيانات'),
                      TextButton(
                        onPressed: () => setState(() {
                          _future = (widget.loadDetail ?? _repo.partnerDetailLoad)(widget.partner.id);
                        }),
                        child: const Text('إعادة المحاولة'),
                      ),
                    ],
                  ),
                );
              }
              final partner = detail.summary;
              if (!isVenue && detail.services.isEmpty) {
                return _brandBody(load, partner, detail);
              }
              return _venueBody(load, partner, detail);
            },
          ),
        );
      },
    );
  }

  Widget _brandBody(CatalogLoad<PartnerDetail> load, PartnerSummary partner, PartnerDetail detail) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (kDebugMode)
          MarketplaceDataBanner(transport: load.transport, contentMark: load.contentMark),
        Text(partner.nameAr, style: AppTypography.headlineSmall.copyWith(color: AppColors.brandBurgundy), textAlign: TextAlign.right),
        if ((partner.descriptionAr ?? '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(partner.descriptionAr!, textAlign: TextAlign.right, style: AppTypography.bodyMedium),
        ],
        if (partner.isBrand && (partner.storeUrl ?? '').isNotEmpty) ...[
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              final opened = await MiraUrlLauncher.openExternal(context, partner.storeUrl!);
              if (!context.mounted || !opened) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('فُتح رابط خارجي. هذا ليس شراءً مكتملًا')),
              );
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.brandBurgundy),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('زيارة المتجر'),
          ),
        ],
        if ((partner.storeUrl ?? '').isEmpty && partner.isBrand)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(MarketplaceCopy.noExternalStore, textAlign: TextAlign.center),
          ),
        if (detail.products.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('المنتجات', style: AppTypography.titleMedium.copyWith(color: AppColors.brandBurgundy), textAlign: TextAlign.right),
          const SizedBox(height: 12),
          for (final product in detail.products)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: MatchedProductTile(
                product: product,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CatalogRecordScope.page(
                      kind: 'product',
                      id: product.id,
                      transport: load.transport,
                      matchKnown: product.matchKnown,
                      matchScore: product.matchScore,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _venueBody(CatalogLoad<PartnerDetail> load, PartnerSummary partner, PartnerDetail detail) {
    final services = detail.services;
    final media = <CatalogMediaLink>[
      for (final s in services) ...CatalogOfferMedia.mainSlides(s.media, kind: s.mainOfferKind),
    ];
    final categories = <String>{
      for (final s in services)
        if ((s.category ?? '').trim().isNotEmpty) s.category!.trim(),
    }.toList();
    final q = _search.text.trim();
    final filtered = services.where((s) {
      if (_categoryFilter != null && (s.category ?? '') != _categoryFilter) return false;
      if (q.isEmpty) return true;
      return s.nameAr.contains(q) || (s.descriptionAr ?? '').contains(q);
    }).toList();
    final selectedServices = services.where((s) => _selectedServiceIds.contains(s.id)).toList();
    final totalHalalas = selectedServices.fold<int>(0, (sum, s) => sum + (s.priceKnown ? s.priceHalalas : 0));

    return Column(
      children: [
        Expanded(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (kDebugMode)
                      MarketplaceDataBanner(transport: load.transport, contentMark: load.contentMark),
                    if (media.isNotEmpty)
                      SizedBox(
                        height: 180,
                        child: CatalogDetailMediaSection(media: media.take(5).toList()),
                      )
                    else
                      Container(
                        height: 140,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(Icons.storefront_outlined, size: 48, color: AppColors.brandBurgundy),
                      ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if ((partner.contactPhone ?? '').trim().isNotEmpty)
                          TextButton.icon(
                            onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:${partner.contactPhone!.trim()}'),
                            icon: Icon(Icons.chat_bubble_outline, color: AppColors.brandBurgundy),
                            label: Text('تواصلني', style: TextStyle(color: AppColors.brandBurgundy)),
                          ),
                        const Spacer(),
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                partner.nameAr,
                                style: AppTypography.headlineSmall.copyWith(color: AppColors.brandBurgundy),
                                textAlign: TextAlign.right,
                              ),
                              Text(
                                partner.city.isEmpty ? 'مدينة غير منشورة' : partner.city,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                                textAlign: TextAlign.right,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    TabBar(
                      controller: _tabs,
                      labelColor: AppColors.brandBurgundy,
                      unselectedLabelColor: AppColors.textSecondary,
                      indicatorColor: AppColors.brandBurgundy,
                      tabs: const [
                        Tab(text: 'الخدمات'),
                        Tab(text: 'المعرض'),
                        Tab(text: 'عن المركز'),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    _servicesTab(filtered, categories, services.length),
                    _galleryTab(media),
                    _aboutTab(partner),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (selectedServices.isNotEmpty)
          Material(
            elevation: 10,
            color: AppColors.surface,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () {
                          for (final s in selectedServices) {
                            BookingBasket.instance.tryAdd(s);
                          }
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => const BookingBasketScreen()),
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.brandBurgundy,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.event_available_outlined),
                        label: const Text('اختاري الموعد'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'حجزك • ${selectedServices.length == 1 ? 'خدمة واحدة' : '${selectedServices.length} خدمات'}',
                          style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                        ),
                        Text(
                          CatalogPrice.text(known: totalHalalas > 0, halalas: totalHalalas),
                          style: AppTypography.titleMedium.copyWith(color: AppColors.brandBurgundy, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _servicesTab(List<CatalogService> filtered, List<String> categories, int totalCount) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        TextField(
          controller: _search,
          onChanged: (_) => setState(() {}),
          textAlign: TextAlign.right,
          decoration: InputDecoration(
            hintText: 'ابحثي عن خدمة',
            prefixIcon: const Icon(Icons.search),
            filled: true,
            fillColor: const Color(0xFFF5F0F2),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          reverse: true,
          child: Row(
            children: [
              _filterChip(label: 'الكل $totalCount', selected: _categoryFilter == null, onTap: () => setState(() => _categoryFilter = null)),
              for (final c in categories)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: _filterChip(
                    label: c,
                    selected: _categoryFilter == c,
                    onTap: () => setState(() => _categoryFilter = c),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'اختاري أكثر من خدمة، ثم حدّدي المواعيد',
          style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
          textAlign: TextAlign.right,
        ),
        const SizedBox(height: 12),
        for (final service in filtered) ...[
          _serviceCard(service),
          const SizedBox(height: 10),
        ],
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text('لا توجد خدمات مطابقة', style: AppTypography.bodyMedium, textAlign: TextAlign.center),
          ),
      ],
    );
  }

  Widget _filterChip({required String label, required bool selected, required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Material(
        color: selected ? AppColors.brandBurgundy : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: selected ? AppColors.brandBurgundy : AppColors.border),
            ),
            child: Text(
              label,
              style: AppTypography.labelMedium.copyWith(color: selected ? Colors.white : AppColors.textPrimary),
            ),
          ),
        ),
      ),
    );
  }

  Widget _serviceCard(CatalogService service) {
    final added = _selectedServiceIds.contains(service.id);
    final imageSlides = CatalogOfferMedia.mainSlides(service.media, kind: service.mainOfferKind)
        .where((m) => m.kind == 'image')
        .toList();
    final thumb = imageSlides.isEmpty ? null : imageSlides.first.url;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5F8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Column(
            children: [
              TextButton(
                onPressed: () {
                  setState(() {
                    if (added) {
                      _selectedServiceIds.remove(service.id);
                    } else {
                      _selectedServiceIds.add(service.id);
                    }
                  });
                },
                child: Text(
                  added ? 'مضافة ✓' : '+ إضافة',
                  style: AppTypography.labelLarge.copyWith(color: AppColors.brandBurgundy),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CatalogRecordScope.page(
                      kind: 'service',
                      id: service.id,
                      matchKnown: service.matchKnown,
                      matchScore: service.matchScore,
                    ),
                  ),
                ),
                child: Text('التفاصيل ›', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
              ),
            ],
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(service.nameAr, style: AppTypography.titleSmall, textAlign: TextAlign.right),
                Text(
                  [
                    if (service.durationMin > 0) '${service.durationMin} د',
                    CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas),
                  ].join(' · '),
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  textAlign: TextAlign.right,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.primaryLight,
            backgroundImage: thumb != null && thumb.startsWith('http') ? NetworkImage(thumb) : null,
            child: thumb == null ? Icon(Icons.spa_outlined, color: AppColors.brandBurgundy) : null,
          ),
        ],
      ),
    );
  }

  Widget _galleryTab(List<CatalogMediaLink> media) {
    if (media.isEmpty) {
      return Center(child: Text('لا توجد وسائط منشورة للمركز', style: AppTypography.bodyMedium));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [CatalogDetailMediaSection(media: media.take(12).toList())],
    );
  }

  Widget _aboutTab(PartnerSummary partner) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(partner.nameAr, style: AppTypography.titleMedium, textAlign: TextAlign.right),
        if ((partner.descriptionAr ?? '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(partner.descriptionAr!, style: AppTypography.bodyMedium, textAlign: TextAlign.right),
        ],
        const SizedBox(height: 8),
        Text(
          partner.city.isEmpty ? 'لا توجد مدينة منشورة' : 'المدينة: ${partner.city}',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
          textAlign: TextAlign.right,
        ),
        if ((partner.contactPhone ?? '').isNotEmpty)
          Text('للتواصل: ${partner.contactPhone}', style: AppTypography.bodyMedium, textAlign: TextAlign.right),
      ],
    );
  }
}
