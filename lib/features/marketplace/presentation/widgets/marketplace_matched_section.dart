import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/marketplace_match.dart';
import 'matched_product_tile.dart';
import 'matched_service_tile.dart';

/// Loads partner catalog match for a skin report (API or local fallback).
class MarketplaceMatchedSection extends StatefulWidget {
  final SkinReport report;
  final bool showServices;
  final bool compactProducts;

  const MarketplaceMatchedSection({
    super.key,
    required this.report,
    this.showServices = true,
    this.compactProducts = false,
  });

  @override
  State<MarketplaceMatchedSection> createState() =>
      _MarketplaceMatchedSectionState();
}

class _MarketplaceMatchedSectionState extends State<MarketplaceMatchedSection> {
  final _repo = MarketplaceRepositoryImpl();
  late Future<MarketplaceMatch> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.matchForReport(widget.report);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MarketplaceMatch>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError) {
          return Text(
            'تعذر تحميل التوصيات — جرّبي لاحقاً',
            style: AppTypography.bodySmall.copyWith(color: AppColors.error),
          );
        }

        final match = snapshot.data ?? MarketplaceMatch.empty;
        if (match.products.isEmpty && match.services.isEmpty) {
          return Text(
            'لا توجد توصيات مطابقة حالياً — تصفّحي قسم اكتشفي',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textSecondary,
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (match.products.isNotEmpty) ...[
              SectionHeader(
                title: 'منتجات مقترحة',
                subtitle: 'من شركاء ميرا — حسب تحليلك',
              ),
              const SizedBox(height: 12),
              if (widget.compactProducts)
                SizedBox(
                  height: 140,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: match.products.take(6).length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) {
                      final p = match.products[i];
                      return MatchedProductTile(
                        product: p,
                        compact: true,
                        onTap: () => _openProduct(context, p),
                      );
                    },
                  ),
                )
              else
                ...match.products.take(8).map(
                      (p) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: MatchedProductTile(
                          product: p,
                          onTap: () => _openProduct(context, p),
                        ),
                      ),
                    ),
            ],
            if (widget.showServices && match.services.isNotEmpty) ...[
              const SizedBox(height: 20),
              const SectionHeader(
                title: 'عيادات وصالونات',
                subtitle: 'خدمات مناسبة لبشرتك',
              ),
              const SizedBox(height: 12),
              ...match.services.take(5).map(
                    (s) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: MatchedServiceTile(
                        service: s,
                        onTap: () => _openService(context, s),
                      ),
                    ),
                  ),
            ],
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () =>
                  Navigator.pushNamed(context, AppRoutes.discover),
              icon: const Icon(Icons.explore_outlined),
              label: const Text('استكشفي كل الشركاء'),
            ),
          ],
        );
      },
    );
  }

  void _openProduct(BuildContext context, CatalogProduct product) {
    Navigator.pushNamed(
      context,
      AppRoutes.productDetail,
      arguments: product,
    );
  }

  void _openService(BuildContext context, CatalogService service) {
    Navigator.pushNamed(
      context,
      AppRoutes.serviceDetail,
      arguments: service,
    );
  }
}
