import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../marketplace/data/catalog_record_scope.dart';
import '../../domain/entities/consultant_discovery_offer.dart';

/// Tappable offer rows — open live CatalogRecordScope; never invent ids.
class ConsultantOfferCards extends StatelessWidget {
  const ConsultantOfferCards({
    super.key,
    required this.offers,
    this.sideOffer,
  });

  final List<ConsultantDiscoveryOffer> offers;
  final ConsultantDiscoveryOffer? sideOffer;

  @override
  Widget build(BuildContext context) {
    final rows = <ConsultantDiscoveryOffer>[
      ...offers.take(3),
      if (sideOffer != null) sideOffer!,
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          _OfferTile(
            offer: rows[i],
            isSide: sideOffer != null && identical(rows[i], sideOffer),
          ),
        ],
      ],
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({required this.offer, required this.isSide});

  final ConsultantDiscoveryOffer offer;
  final bool isSide;

  @override
  Widget build(BuildContext context) {
    final actionLabel = offer.actionLabelAr ??
        switch (offer.action) {
          'book' => 'احجزي',
          'buy' => 'اطلبي',
          _ => 'عرض التفاصيل',
        };
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        key: Key('consultant_offer_${offer.kind}_${offer.id}'),
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (offer.id.isEmpty) return;
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => CatalogRecordScope.page(
                kind: offer.kind,
                id: offer.id,
                bookingBranchId: offer.branchId,
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isSide)
                      Text(
                        'اقتراح جانبي',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textTertiary,
                        ),
                      ),
                    Text(
                      offer.titleAr,
                      textDirection: TextDirection.rtl,
                      style: AppTypography.bodyMedium.copyWith(height: 1.35),
                    ),
                    if (offer.priceLabelAr != null && offer.priceLabelAr!.isNotEmpty)
                      Text(
                        offer.priceLabelAr!,
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    if (offer.inStock == false)
                      Text(
                        'غير متوفر حالياً',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.gold,
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                actionLabel,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.primaryDark,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
