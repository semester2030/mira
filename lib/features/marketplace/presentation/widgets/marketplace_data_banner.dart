import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/catalog_provenance.dart';

class MarketplaceDataBanner extends StatelessWidget {
  const MarketplaceDataBanner({
    super.key,
    required this.transport,
    required this.contentMark,
  });

  final CatalogTransport transport;
  final ContentMark contentMark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardPink,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Text(
        labelFor(transport, contentMark),
        style: AppTypography.bodySmall.copyWith(height: 1.5),
      ),
    );
  }

  static String labelFor(CatalogTransport transport, ContentMark mark) {
    if (mark == ContentMark.mixed) return MarketplaceCopy.mixedContentBanner;
    return switch ((transport, mark)) {
      (CatalogTransport.server, ContentMark.explicitDemo) => MarketplaceCopy.serverDemoBanner,
      (CatalogTransport.server, _) => MarketplaceCopy.serverUnmarkedBanner,
      (CatalogTransport.localCatalog, ContentMark.explicitDemo) => MarketplaceCopy.localDemoBanner,
      (CatalogTransport.localCatalog, _) => MarketplaceCopy.localUnmarkedBanner,
    };
  }
}
