import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/discover_published_ad.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../widgets/catalog_detail_media_section.dart';

/// Full-screen player for one published creator ad (fetched by id).
class CelebrityAdPlayerScreen extends StatefulWidget {
  const CelebrityAdPlayerScreen({super.key, required this.adId});

  final String adId;

  @override
  State<CelebrityAdPlayerScreen> createState() => _CelebrityAdPlayerScreenState();
}

class _CelebrityAdPlayerScreenState extends State<CelebrityAdPlayerScreen> {
  final _repo = MarketplaceRepositoryImpl();
  DiscoverPublishedAd? _ad;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final ad = await _repo.getPublicAd(widget.adId);
      if (!mounted) return;
      setState(() {
        _ad = ad;
        _loading = false;
        _failed = ad == null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  void _openTarget() {
    final ad = _ad;
    if (ad == null) return;
    if (ad.product != null) {
      Navigator.of(context).pushNamed(AppRoutes.productDetail, arguments: ad.product);
      return;
    }
    if (ad.service != null) {
      Navigator.of(context).pushNamed(AppRoutes.serviceDetail, arguments: ad.service);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          ad?.link.caption.isNotEmpty == true ? ad!.link.caption : 'إعلان',
          style: AppTypography.titleMedium.copyWith(color: Colors.white),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _failed || ad == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'تعذر تحميل الإعلان',
                        style: AppTypography.bodyLarge.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: 12),
                      TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: CatalogDetailMediaSection(media: ad.media),
                    ),
                    Container(
                      width: double.infinity,
                      color: AppColors.background,
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            ad.link.caption,
                            style: AppTypography.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            ad.link.disclosureLine,
                            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                          ),
                          if (ad.link.creatorDisplayName != null &&
                              ad.link.creatorDisplayName!.trim().isNotEmpty) ...[
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: ad.link.creatorId == null
                                  ? null
                                  : () {
                                      Navigator.of(context).pushNamed(
                                        AppRoutes.celebrityProfile,
                                        arguments: ad.link.creatorId,
                                      );
                                    },
                              child: Text(ad.link.creatorDisplayName!),
                            ),
                          ],
                          TextButton(
                            onPressed: null,
                            child: Text('الجهة: ${ad.link.sellerName}'),
                          ),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: _openTarget,
                            child: Text(
                              ad.link.targetKind == 'service' ? 'عرض الخدمة' : 'عرض المنتج',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}