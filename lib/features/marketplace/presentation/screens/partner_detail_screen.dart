import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/partner_detail.dart';
import '../../domain/entities/partner_summary.dart';
import '../widgets/matched_product_tile.dart';
import '../widgets/matched_service_tile.dart';

class PartnerDetailScreen extends StatefulWidget {
  final PartnerSummary partner;

  const PartnerDetailScreen({super.key, required this.partner});

  @override
  State<PartnerDetailScreen> createState() => _PartnerDetailScreenState();
}

class _PartnerDetailScreenState extends State<PartnerDetailScreen> {
  final _repo = MarketplaceRepositoryImpl();
  late Future<PartnerDetail?> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.getPartnerDetail(widget.partner.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: MiraAppBar(pageTitle: widget.partner.nameAr),
      body: FutureBuilder<PartnerDetail?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final detail = snapshot.data;
          if (detail == null) {
            return const Center(child: Text('تعذر تحميل التفاصيل'));
          }

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Center(
                child: Text(
                  widget.partner.logoEmoji ?? '✨',
                  style: const TextStyle(fontSize: 48),
                ),
              ),
              if (widget.partner.descriptionAr != null) ...[
                const SizedBox(height: 8),
                Text(
                  widget.partner.descriptionAr!,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium,
                ),
              ],
              if (widget.partner.isBrand && widget.partner.storeUrl != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () async {
                    final uri = Uri.tryParse(widget.partner.storeUrl!);
                    if (uri != null) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
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
                      onTap: () => Navigator.pushNamed(
                        context,
                        AppRoutes.productDetail,
                        arguments: p,
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
                      onTap: () => Navigator.pushNamed(
                        context,
                        AppRoutes.serviceDetail,
                        arguments: s,
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
  }
}
