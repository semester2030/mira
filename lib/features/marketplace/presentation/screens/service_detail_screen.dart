import 'package:flutter/material.dart';

import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/catalog_price.dart';
import '../../domain/entities/catalog_service.dart';

class ServiceDetailScreen extends StatelessWidget {
  final CatalogService service;
  final Widget? provenance;

  const ServiceDetailScreen({super.key, required this.service, this.provenance});

  @override
  Widget build(BuildContext context) {
    final typeLabel = service.isClinic ? 'عيادة' : 'صالون';

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل الخدمة'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (provenance != null) provenance!,
              Center(
                child: Text(
                  service.partnerEmoji ?? '✨',
                  style: const TextStyle(fontSize: 64),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '$typeLabel · ${service.city}',
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              Text(
                service.nameAr,
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              Text(
                service.partnerNameAr,
                style: AppTypography.titleMedium,
                textAlign: TextAlign.center,
              ),
              if (service.descriptionAr != null) ...[
                const SizedBox(height: 8),
                Text(
                  service.descriptionAr!,
                  style: AppTypography.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 16),
              PremiumCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    if (service.durationMin > 0) _info('المدة', '${service.durationMin} د'),
                    _info('السعر', CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas)),
                    if (service.matchKnown) _info('التطابق', '${service.matchScore}%'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                service.city.isEmpty ? 'لا توجد مدينة منشورة' : 'المدينة المسجّلة: ${service.city}. هذا ليس موقع فرع بإحداثيات.',
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                (service.contactPhone ?? '').isEmpty ? 'لا توجد وسيلة تواصل منشورة لهذه الجهة.' : service.contactPhone!,
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              if ((service.contactPhone ?? '').trim().isNotEmpty)
                PremiumButton(
                  label: 'تواصلي',
                  icon: Icons.phone_outlined,
                  variant: PremiumButtonVariant.gold,
                  onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:${service.contactPhone!.trim()}'),
                ),
            ],
          ),
        ),
    );
  }

  Widget _info(String label, String value) {
    return Column(
      children: [
        Text(label, style: AppTypography.labelSmall),
        Text(value, style: AppTypography.titleMedium),
      ],
    );
  }
}
