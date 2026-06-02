import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/catalog_service.dart';

class ServiceDetailScreen extends StatelessWidget {
  final CatalogService service;

  const ServiceDetailScreen({super.key, required this.service});

  @override
  Widget build(BuildContext context) {
    final typeLabel = service.isClinic ? 'عيادة' : 'صالون';

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل الخدمة'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                    _info('المدة', '${service.durationMin} د'),
                    _info('السعر', service.priceLabel),
                    _info('التطابق', '${service.matchScore}%'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PremiumCard(
                child: Text(
                  'الحجز الإلكتروني الكامل سيُفعّل مع بوابة الشركاء (المرحلة القادمة). '
                  'حالياً تواصلي مع ${service.partnerNameAr} مباشرة أو انتظري إشعار ميرا.',
                  style: AppTypography.bodyMedium.copyWith(height: 1.5),
                ),
              ),
              const Spacer(),
              PremiumButton(
                label: service.bookingEnabled ? 'احجزي الآن' : 'الحجز قريباً',
                icon: Icons.calendar_month_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: service.bookingEnabled
                    ? null
                    : () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'سنُفعّل الحجز لـ ${service.partnerNameAr} قريباً ✨',
                              style: AppTypography.bodyMedium.copyWith(
                                color: AppColors.onPrimary,
                              ),
                            ),
                          ),
                        );
                      },
              ),
            ],
          ),
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
