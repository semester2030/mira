import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_provenance.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/partner_summary.dart';
import '../widgets/marketplace_data_banner.dart';
import 'partner_detail_screen.dart';

class PartnerListScreen extends StatefulWidget {
  final String partnerType;

  const PartnerListScreen({super.key, required this.partnerType});

  @override
  State<PartnerListScreen> createState() => _PartnerListScreenState();
}

class _PartnerListScreenState extends State<PartnerListScreen> {
  final _repo = MarketplaceRepositoryImpl();
  late Future<CatalogLoad<List<PartnerSummary>>> _future;

  String get _title {
    switch (widget.partnerType) {
      case 'brand':
        return 'ماركات التجميل';
      case 'clinic':
        return 'عيادات التجميل';
      case 'salon':
        return 'صالونات التجميل';
      default:
        return 'الشركاء';
    }
  }

  @override
  void initState() {
    super.initState();
    _future = _repo.listPartnersLoad(type: widget.partnerType);
  }

  Future<void> _openStore(PartnerSummary partner) async {
    final url = partner.storeUrl;
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _openDetail(PartnerSummary partner) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PartnerDetailScreen(partner: partner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: MiraAppBar(pageTitle: _title),
      body: FutureBuilder<CatalogLoad<List<PartnerSummary>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('تعذر التحميل: ${snapshot.error}'));
          }
          final load = snapshot.data;
          final partners = load?.value ?? [];
          if (partners.isEmpty) {
            return const Center(child: Text('لا يوجد شركاء في هذه الفئة حالياً'));
          }

          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: partners.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              if (i == 0 && load != null) {
                return MarketplaceDataBanner(
                  transport: load.transport,
                  contentMark: load.contentMark,
                );
              }
              final p = partners[i - 1];
              return ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                ),
                tileColor: AppColors.surface,
                leading: CircleAvatar(
                  backgroundColor: AppColors.primaryLight,
                  child: Text(p.logoEmoji ?? '✨', style: const TextStyle(fontSize: 22)),
                ),
                title: Text(p.nameAr, style: AppTypography.titleMedium),
                subtitle: Text(
                  p.descriptionAr ?? '${p.city} · ${p.rating.toStringAsFixed(1)} ★',
                  style: AppTypography.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: p.isBrand
                    ? IconButton(
                        tooltip: 'رابط المتجر الخارجي',
                        onPressed: () => _openStore(p),
                        icon: const Icon(Icons.open_in_new_rounded),
                      )
                    : const Icon(Icons.chevron_left_rounded),
                onTap: () => _openDetail(p),
              );
            },
          );
        },
      ),
    );
  }
}
