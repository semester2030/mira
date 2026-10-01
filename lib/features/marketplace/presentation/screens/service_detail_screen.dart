import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/catalog_price.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/catalog_service_template.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/catalog_detail_media_section.dart';

class ServiceDetailScreen extends StatelessWidget {
  final CatalogService service;
  final Widget? provenance;

  const ServiceDetailScreen({super.key, required this.service, this.provenance});

  String get _priceText {
    switch (service.profile.priceMode) {
      case CatalogServicePriceMode.afterAssessment:
        return 'يُحدد بعد التقييم';
      case CatalogServicePriceMode.unknown:
        return CatalogPrice.text(known: false, halalas: 0);
      case CatalogServicePriceMode.from:
        final base = CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas);
        return service.priceKnown ? 'يبدأ من $base' : base;
      case CatalogServicePriceMode.fixed:
        return CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas);
    }
  }

  IconData _icon(String key) {
    return switch (key) {
      'includes' => Icons.check_circle_outline,
      'options' => Icons.tune,
      'price' => Icons.schedule,
      'place' => Icons.place_outlined,
      'prep' => Icons.checklist_rtl,
      'policies' => Icons.policy_outlined,
      'overview' => Icons.info_outline,
      _ => Icons.info_outline,
    };
  }

  /// Appointment only. Preview stays honest, real services need `bookingEnabled`.
  Future<void> _requestAppointment(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    if (service.id.startsWith('preview-')) {
      messenger.showSnackBar(const SnackBar(content: Text(MarketplaceCopy.previewAppointment)));
      return;
    }
    if (!service.bookingEnabled) {
      messenger.showSnackBar(const SnackBar(content: Text(MarketplaceCopy.appointmentUnavailable)));
      return;
    }
    await Navigator.of(context).pushNamed(AppRoutes.bookingRequest, arguments: service);
  }

  @override
  Widget build(BuildContext context) {
    final typeLabel = service.isClinic ? 'عيادة' : 'صالون';
    final details = CatalogOfferMedia.detailMedia(service.media);
    final template = service.template;
    final profile = service.profile;
    final rows = template == null
        ? const <({CatalogServiceFieldDef field, CatalogServiceAnswer answer, String display})>[]
        : CatalogServiceTemplateEngine.detailRows(template: template, profile: profile);

    final bySection = <String, List<({CatalogServiceFieldDef field, CatalogServiceAnswer answer, String display})>>{};
    for (final row in rows) {
      bySection.putIfAbsent(row.field.sectionId, () => []).add(row);
    }

    final needsAssessment = profile.answer('needs_assessment').asBool() == true;
    final phone = (service.contactPhone ?? '').trim();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل الخدمة'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (provenance != null) provenance!,
            Text(
              '$typeLabel · ${service.city}',
              style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
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
            if (template != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  template.labelAr,
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
              ),
            if (service.descriptionAr != null && service.descriptionAr!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                service.descriptionAr!,
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 16),
            PremiumCard(
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      if (service.durationMin > 0) _info('مدة الجلسة', '${service.durationMin} د'),
                      _info('السعر', _priceText),
                      if (service.category != null) _info('التصنيف', service.category!),
                    ],
                  ),
                  if (needsAssessment) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary),
                      ),
                      child: Text(
                        'يلزم تقييم مسبق قبل الموعد.',
                        style: AppTypography.labelLarge.copyWith(color: AppColors.primaryDark),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (template != null) ...[
              for (final section in template.sections) ...[
                if (bySection[section.id]?.isNotEmpty == true) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(section.titleAr, _icon(section.iconKey)),
                  const SizedBox(height: 8),
                  PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final row in bySection[section.id]!) ...[
                          Text(row.field.labelAr, style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          if (row.field.type == CatalogServiceFieldType.multiSelect ||
                              row.field.type == CatalogServiceFieldType.singleSelect)
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final part in row.display.split('، '))
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryLight,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Text(part, style: AppTypography.labelLarge),
                                  ),
                              ],
                            )
                          else
                            _ExpandableText(row.display),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ],
            if (details.isNotEmpty) ...[
              const SizedBox(height: 20),
              _sectionTitle('الصور والفيديو', Icons.photo_library_outlined),
              const SizedBox(height: 8),
              CatalogDetailMediaSection(media: details),
            ],
            const SizedBox(height: 16),
            Text(
              service.id.startsWith('preview-')
                  ? 'موقع المعاينة: ${service.city}. هذا ليس موقعك ولا فرعًا بإحداثيات، ولا تُحسب مسافة.'
                  : (service.city.isEmpty
                      ? 'لا توجد مدينة منشورة'
                      : 'المدينة المسجّلة: ${service.city}. هذا ليس موقع فرع بإحداثيات.'),
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
            if (service.id.startsWith('preview-'))
              Text(
                'الإجراء تجريبي في المعاينة.',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            if (phone.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(phone, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
            ] else ...[
              const SizedBox(height: 8),
              Text(
                'لا توجد وسيلة تواصل منشورة لهذه الجهة.',
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            if (!service.bookingEnabled)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  MarketplaceCopy.appointmentUnavailable,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
              ),
            const SizedBox(height: 24),
            PremiumButton(
              label: 'طلب الموعد',
              icon: Icons.event_available_outlined,
              variant: PremiumButtonVariant.gold,
              onPressed: () => _requestAppointment(context),
            ),
            if (phone.isNotEmpty && !service.id.startsWith('preview-')) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:$phone'),
                icon: const Icon(Icons.phone_outlined),
                label: const Text('تواصلي'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 20),
        const SizedBox(width: 8),
        Text(title, style: AppTypography.titleSmall),
      ],
    );
  }

  Widget _info(String label, String value) {
    return Column(
      children: [
        Text(label, style: AppTypography.labelSmall),
        Text(value, style: AppTypography.titleMedium, textAlign: TextAlign.center),
      ],
    );
  }
}

class _ExpandableText extends StatefulWidget {
  const _ExpandableText(this.text);

  final String text;

  @override
  State<_ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<_ExpandableText> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final long = widget.text.length > 140;
    final shown = !_expanded && long ? '${widget.text.substring(0, 140)}…' : widget.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(shown, style: AppTypography.bodyMedium),
        if (long)
          TextButton(
            onPressed: () => setState(() => _expanded = !_expanded),
            child: Text(_expanded ? 'عرض أقل' : 'عرض المزيد'),
          ),
      ],
    );
  }
}
