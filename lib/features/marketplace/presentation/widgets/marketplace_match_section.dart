import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/marketplace_match.dart';
import '../screens/product_detail_screen.dart';
import '../screens/service_detail_screen.dart';
import 'matched_product_tile.dart';
import 'matched_service_tile.dart';

/// Loads partner catalog matched to [report] — API or local fallback.
class MarketplaceMatchSection extends StatefulWidget {
  final SkinReport report;
  final bool compactProducts;
  final bool showServices;
  final bool showDiscoverLink;

  const MarketplaceMatchSection({
    super.key,
    required this.report,
    this.compactProducts = false,
    this.showServices = true,
    this.showDiscoverLink = true,
  });

  @override
  State<MarketplaceMatchSection> createState() => _MarketplaceMatchSectionState();
}

class _MarketplaceMatchSectionState extends State<MarketplaceMatchSection> {
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

        final match = snapshot.data ?? MarketplaceMatch.empty;
        if (match.products.isEmpty && match.services.isEmpty) {
          return Text(
            'لا توجد توصيات شركاء حالياً — جرّبي لاحقاً.',
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
                subtitle: 'حسب تحليل بشرتك — تسوقي من متاجر الشركاء',
              ),
              const SizedBox(height: 12),
              if (widget.compactProducts)
                SizedBox(
                  height: 150,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: match.products.length.clamp(0, 6),
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) => MatchedProductTile(
                      product: match.products[i],
                      compact: true,
                      onTap: () => _openProduct(context, match.products[i]),
                    ),
                  ),
                )
              else
                ...match.products.map(
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
                subtitle: 'خدمات مناسبة لاحتياجات بشرتك',
              ),
              const SizedBox(height: 12),
              ...match.services.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: MatchedServiceTile(
                    service: s,
                    onTap: () => _openService(context, s),
                  ),
                ),
              ),
            ],
            if (widget.showDiscoverLink) ...[
              const SizedBox(height: 16),
              PremiumButton(
                label: 'استكشفي كل الشركاء',
                variant: PremiumButtonVariant.secondary,
                icon: Icons.storefront_rounded,
                onPressed: () => Navigator.pushNamed(context, AppRoutes.discover),
              ),
            ],
          ],
        );
      },
    );
  }

  void _openProduct(BuildContext context, product) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ProductDetailScreen(product: product),
      ),
    );
  }

  void _openService(BuildContext context, service) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ServiceDetailScreen(service: service),
      ),
    );
  }
}
