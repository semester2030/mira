import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/discover_catalog_gateway.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/creator_profile.dart';
import '../../domain/entities/partner_summary.dart';
import '../widgets/celebrity_avatar_orb.dart';
import 'celebrity_ad_player_screen.dart';
import 'partner_catalog_surface.dart';
import 'partner_detail_screen.dart';

class CelebrityProfileScreen extends StatefulWidget {
  const CelebrityProfileScreen({super.key, required this.creatorId});

  final String creatorId;

  @override
  State<CelebrityProfileScreen> createState() => _CelebrityProfileScreenState();
}

class _CelebrityProfileScreenState extends State<CelebrityProfileScreen> {
  final _repo = MarketplaceRepositoryImpl();
  CreatorPublicProfile? _profile;
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
      final profile = await _repo.getCreatorProfile(widget.creatorId);
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loading = false;
        _failed = profile == null;
      });
    } on CatalogSourceException {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  Future<void> _openPartnerCatalog({required bool store}) async {
    final profile = _profile;
    if (profile == null) return;
    final partner = await _repo.getPartner(profile.partnerId);
    if (!mounted) return;
    final summary = partner ??
        PartnerSummary(
          id: profile.partnerId,
          type: profile.partnerType ?? (store ? 'brand' : 'salon'),
          nameAr: profile.displayNameAr,
          nameEn: '',
          city: 'الرياض',
          rating: 4.5,
        );
    final surface = store ? PartnerCatalogSurface.store : PartnerCatalogSurface.provider;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PartnerDetailScreen(partner: summary, surface: surface),
      ),
    );
  }

  void _openAd(String adId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CelebrityAdPlayerScreen(adId: adId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    const orbD = 112.0;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: MiraAppBar(pageTitle: profile?.displayNameAr ?? 'الملف'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _failed || profile == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('تعذر تحميل الملف', style: AppTypography.bodyLarge),
                      const SizedBox(height: 12),
                      TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                )
              : ListView(
                  key: PageStorageKey<String>('celebrity-profile-${profile.id}'),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  children: [
                    Center(
                      child: CelebrityAvatarOrb(
                        nameAr: profile.displayNameAr,
                        diameter: orbD,
                        avatarUrl: profile.avatarUrl,
                      ),
                    ),
                    if (profile.bioAr != null && profile.bioAr!.trim().isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        profile.bioAr!,
                        textAlign: TextAlign.center,
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                    ],
                    if (profile.hasStore || profile.hasServices) ...[
                      const SizedBox(height: 20),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (profile.hasStore)
                            ActionChip(
                              label: const Text('المتجر'),
                              onPressed: () => _openPartnerCatalog(store: true),
                            ),
                          if (profile.hasServices)
                            ActionChip(
                              label: const Text('الخدمات'),
                              onPressed: () => _openPartnerCatalog(store: false),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),
                    Text('إعلانات منشورة', style: AppTypography.titleMedium),
                    const SizedBox(height: 12),
                    if (profile.publishedAdIds.isEmpty)
                      Text(
                        profile.emptyAdsMessage ?? 'لا توجد إعلانات منشورة بعد',
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      )
                    else
                      for (final adId in profile.publishedAdIds)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(color: AppColors.border.withValues(alpha: 0.4)),
                            ),
                            tileColor: AppColors.surface,
                            title: const Text('إعلان منشور'),
                            subtitle: Text(adId, style: AppTypography.bodySmall),
                            trailing: const Icon(Icons.play_circle_outline_rounded),
                            onTap: () => _openAd(adId),
                          ),
                        ),
                  ],
                ),
    );
  }
}