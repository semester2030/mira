import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../data/catalog_price.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/entities/catalog_service.dart';
import '../occasion_plan.dart';
import '../widgets/catalog_detail_media_section.dart';
import 'my_occasion_screen.dart';

/// باقة قاعة مناسبة — معرض، تاريخ/ضيفات، باقة + إضافات، طلب حجز.
class VenuePackageScreen extends StatefulWidget {
  const VenuePackageScreen({super.key, required this.service});

  final CatalogService service;

  @override
  State<VenuePackageScreen> createState() => _VenuePackageScreenState();
}

class _VenuePackageScreenState extends State<VenuePackageScreen> {
  DateTime _date = DateTime(2026, 12, 11);
  int _guests = 80;
  var _flowers = true;
  var _hospitality = true;

  CatalogService get service => widget.service;

  int get _baseHalalas => service.priceKnown ? service.priceHalalas : 0;

  /// Estimate stays on the published package price — UI add-ons do not invent SAR amounts.
  int get _estimate => _baseHalalas;

  @override
  Widget build(BuildContext context) {
    final media = CatalogOfferMedia.mainSlides(service.media, kind: service.mainOfferKind);
    final city = service.city.isEmpty ? 'مدينة غير منشورة' : service.city;
    final phone = (service.contactPhone ?? '').trim();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const MirraLogo.appBar(),
        actions: [
          IconButton(onPressed: () {}, icon: Icon(Icons.favorite_border, color: AppColors.brandBurgundy)),
          IconButton(onPressed: () {}, icon: Icon(Icons.ios_share_outlined, color: AppColors.brandBurgundy)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                if (media.isNotEmpty)
                  CatalogDetailMediaSection(media: media, videoCover: CatalogOfferMedia.videoCover(service.media))
                else
                  Container(
                    height: 180,
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(16)),
                    child: Icon(Icons.location_city_outlined, size: 48, color: AppColors.brandBurgundy),
                  ),
                const SizedBox(height: 12),
                Text(
                  service.partnerNameAr.isNotEmpty ? service.partnerNameAr : service.nameAr,
                  style: AppTypography.headlineSmall.copyWith(color: AppColors.brandBurgundy, fontWeight: FontWeight.w700),
                  textAlign: TextAlign.right,
                ),
                Row(
                  children: [
                    if (phone.isNotEmpty)
                      OutlinedButton.icon(
                        onPressed: () {},
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.brandBurgundy, side: BorderSide(color: AppColors.brandBurgundy)),
                        icon: const Icon(Icons.chat_bubble_outline, size: 18),
                        label: const Text('تواصل'),
                      ),
                    const Spacer(),
                    Icon(Icons.place_outlined, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(city, style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary)),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    _metaChip(Icons.schedule, service.durationMin > 0 ? '${service.durationMin ~/ 60} ساعات' : 'المدة غير محددة'),
                    const SizedBox(width: 8),
                    _metaChip(Icons.people_outline, 'حتى $_guests ضيفة'),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _editField(Icons.people_outline, '$_guests ضيفة', () async {
                      final c = TextEditingController(text: '$_guests');
                      final v = await showDialog<int>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('عدد الضيفات'),
                          content: TextField(controller: c, keyboardType: TextInputType.number, textAlign: TextAlign.right),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
                            TextButton(onPressed: () => Navigator.pop(ctx, int.tryParse(c.text.trim())), child: const Text('حفظ')),
                          ],
                        ),
                      );
                      if (v != null && v > 0) setState(() => _guests = v);
                    })),
                    const SizedBox(width: 8),
                    Expanded(child: _editField(Icons.calendar_today_outlined, _fmt(_date), () async {
                      final p = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2026), lastDate: DateTime(2028, 12, 31));
                      if (p != null) setState(() => _date = p);
                    })),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    TextButton(onPressed: () {}, child: Text('غيّري الباقة', style: TextStyle(color: AppColors.brandBurgundy))),
                    const Spacer(),
                    Text('الباقة المختارة', style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy)),
                  ],
                ),
                _packageCard(
                  selected: true,
                  title: service.nameAr,
                  subtitle: (service.descriptionAr ?? '').trim().isEmpty ? 'تفاصيل الباقة من المقدّم' : service.descriptionAr!,
                  price: CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas),
                ),
                const SizedBox(height: 14),
                Text('أضيفي لمستك', style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy), textAlign: TextAlign.right),
                const SizedBox(height: 8),
                _addon(
                  title: 'الضيافة',
                  subtitle: 'لـ $_guests ضيفة — يظهر السعر إن نشره المقدّم',
                  selected: _hospitality,
                  onChanged: (v) => setState(() => _hospitality = v),
                ),
                const SizedBox(height: 8),
                _addon(
                  title: 'تنسيق الورد',
                  subtitle: 'إضافة منفصلة — لا تُحسب مرتين إن كانت مشمولة',
                  selected: _flowers,
                  onChanged: (v) => setState(() => _flowers = v),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.chevron_left, color: AppColors.textTertiary),
                  title: Text('تفاصيل الباقة وسياسة الإلغاء', style: AppTypography.bodyMedium, textAlign: TextAlign.right),
                  trailing: Icon(Icons.description_outlined, color: AppColors.brandBurgundy),
                  onTap: () {},
                ),
                Text(
                  'يتأكد الموعد بعد موافقة القاعة',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 88),
              ],
            ),
          ),
          Material(
            elevation: 10,
            color: AppColors.surface,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () {
                          OccasionPlan.instance.upsert(
                            OccasionPlanItem(
                              serviceId: service.id,
                              partnerId: service.partnerId,
                              partnerNameAr: service.partnerNameAr,
                              summaryAr: [
                                service.nameAr,
                                if (_hospitality) 'ضيافة',
                                if (_flowers) 'ورد',
                              ].join(' + '),
                              priceHalalas: _estimate,
                              priceKnown: service.priceKnown,
                              statusLabelAr: 'بانتظار الرد',
                            ),
                          );
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => const MyOccasionScreen(initialTitleAr: 'مناسبتي')),
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.brandBurgundy,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.event_available_outlined),
                        label: Text(service.bookingEnabled ? 'اطلبي الحجز' : 'اطلبي عرض سعر'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('التكلفة التقديرية', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                        Text(
                          CatalogPrice.text(known: service.priceKnown, halalas: _estimate),
                          style: AppTypography.titleMedium.copyWith(color: AppColors.brandBurgundy, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFFCE8F0), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AppTypography.labelMedium),
          const SizedBox(width: 4),
          Icon(icon, size: 16, color: AppColors.brandBurgundy),
        ],
      ),
    );
  }

  Widget _editField(IconData icon, String label, VoidCallback onTap) {
    return Material(
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.brandBurgundy.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 14, color: AppColors.brandBurgundy),
              const SizedBox(width: 6),
              Expanded(child: Text(label, textAlign: TextAlign.right, style: AppTypography.labelLarge)),
              Icon(icon, size: 16, color: AppColors.brandBurgundy),
            ],
          ),
        ),
      ),
    );
  }

  Widget _packageCard({required bool selected, required String title, required String subtitle, required String price}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: selected ? AppColors.brandBurgundy : AppColors.border, width: selected ? 2 : 1),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: const Color(0xFFFCE8F0), borderRadius: BorderRadius.circular(20)),
            child: Text(price, style: AppTypography.labelLarge.copyWith(color: AppColors.brandBurgundy)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(title, style: AppTypography.titleSmall, textAlign: TextAlign.right),
                Text(subtitle, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.right, maxLines: 2),
              ],
            ),
          ),
          Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.brandBurgundy),
        ],
      ),
    );
  }

  Widget _addon({required String title, required String subtitle, required bool selected, required ValueChanged<bool> onChanged}) {
    return Material(
      color: const Color(0xFFFFF5F8),
      borderRadius: BorderRadius.circular(14),
      child: CheckboxListTile(
        value: selected,
        onChanged: (v) => onChanged(v ?? false),
        activeColor: AppColors.brandBurgundy,
        title: Text(title, textAlign: TextAlign.right, style: AppTypography.titleSmall),
        subtitle: Text(subtitle, textAlign: TextAlign.right, style: AppTypography.bodySmall),
        controlAffinity: ListTileControlAffinity.leading,
      ),
    );
  }

  String _fmt(DateTime d) {
    const months = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return '${d.day} ${months[d.month]} ${d.year}';
  }
}
