import 'package:flutter/material.dart';
import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/utils/mira_url_launcher.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_provenance.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/partner_detail.dart';
import '../../domain/entities/partner_summary.dart';
import '../widgets/marketplace_data_banner.dart';
import '../../data/catalog_record_scope.dart';
import '../widgets/matched_product_tile.dart';
import '../widgets/matched_service_tile.dart';

class PartnerDetailScreen extends StatefulWidget {
  final PartnerSummary partner;
  final CatalogLoad<PartnerDetail>? initial;
  final Future<CatalogLoad<PartnerDetail>?> Function(String id)? loadDetail;

  const PartnerDetailScreen({super.key, required this.partner, this.initial, this.loadDetail});

  @override
  State<PartnerDetailScreen> createState() => _PartnerDetailScreenState();
}

class _PartnerDetailScreenState extends State<PartnerDetailScreen> {
  final _repo = MarketplaceRepositoryImpl();
  late Future<CatalogLoad<PartnerDetail>?> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.initial == null
        ? (widget.loadDetail ?? _repo.partnerDetailLoad)(widget.partner.id)
        : Future.value(widget.initial);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogLoad<PartnerDetail>?>(
      future: _future,
      builder: (context, snapshot) {
        final loadedName = snapshot.data?.value.summary.nameAr;
        return Scaffold(
      backgroundColor: AppColors.background,
      appBar: MiraAppBar(pageTitle: loadedName ?? widget.partner.nameAr),
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

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              MarketplaceDataBanner(
                transport: load.transport,
                contentMark: load.contentMark,
              ),
              const Center(
                child: Icon(Icons.storefront_outlined, size: 48, color: AppColors.primary),
              ),
              if ((partner.descriptionAr ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  partner.descriptionAr!,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium,
                ),
              ],
              Text(
                (partner.contactPhone ?? '').isEmpty
                    ? 'لا توجد وسيلة تواصل منشورة'
                    : partner.contactPhone!,
                textAlign: TextAlign.center,
              ),
              if (partner.isBrand && (partner.storeUrl ?? '').isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(MarketplaceCopy.noExternalStore, textAlign: TextAlign.center),
                ),
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
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('زيارة المتجر'),
                ),
              ],
              if (detail.products.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('المنتجات', style: AppTypography.headlineSmall),
                const SizedBox(height: 12),
                ...detail.products.map(
                  (p) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: MatchedProductTile(
                      product: p,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => CatalogRecordScope.page(
                            kind: 'product',
                            id: p.id,
                            transport: load.transport,
                            matchKnown: p.matchKnown,
                            matchScore: p.matchScore,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
              if (detail.services.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('الخدمات', style: AppTypography.headlineSmall),
                const SizedBox(height: 12),
                ...detail.services.map(
                  (s) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: MatchedServiceTile(
                      service: s,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => CatalogRecordScope.page(
                            kind: 'service',
                            id: s.id,
                            transport: load.transport,
                            matchKnown: s.matchKnown,
                            matchScore: s.matchScore,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
      },
    );
  }
}
