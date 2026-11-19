import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../booking_basket.dart';
import 'booking_request_screen.dart';
import 'booking_visit_consecutive_screen.dart';

enum VisitBookingMode { consecutive, separate }

/// «حجزك» — consecutive visit plan vs separate appointment *requests*.
class BookingBasketScreen extends StatefulWidget {
  const BookingBasketScreen({super.key, this.client});

  final CommerceClient? client;

  @override
  State<BookingBasketScreen> createState() => _BookingBasketScreenState();
}

class _BookingBasketScreenState extends State<BookingBasketScreen> {
  VisitBookingMode _mode = VisitBookingMode.consecutive;
  final Set<String> _submittedIds = {};

  @override
  void initState() {
    super.initState();
    BookingBasket.instance.addListener(_onBasket);
    BookingBasket.instance.pruneDisabled();
  }

  @override
  void dispose() {
    BookingBasket.instance.removeListener(_onBasket);
    super.dispose();
  }

  void _onBasket() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final basket = BookingBasket.instance;
    final items = basket.items;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'حجزك'),
      body: SafeArea(
        child: items.isEmpty
            ? Center(
                child: Text(
                  'أضيفي خدمتين من تفاصيل الخدمات ثم ارجعي هنا.',
                  style: AppTypography.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'الطلبات تُراجعها الجهة — ليست حجزًا مؤكدًا حتى تردّ.',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text('الخدمات المختارة', style: AppTypography.titleSmall),
                  const SizedBox(height: 8),
                  for (final s in items)
                    Card(
                      key: Key('basket_item_${s.id}'),
                      child: ListTile(
                        title: Text(s.nameAr, style: AppTypography.titleSmall),
                        subtitle: Text(
                          [
                            CatalogPrice.text(known: s.priceKnown, halalas: s.priceHalalas),
                            if (s.durationMin > 0) '${s.durationMin} د',
                            s.partnerNameAr,
                            if (_submittedIds.contains(s.id)) '· طُلب',
                          ].join(' · '),
                          style: AppTypography.bodySmall,
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => basket.remove(s.id),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text('ترتيب الزيارة', style: AppTypography.titleSmall),
                  RadioListTile<VisitBookingMode>(
                    key: const Key('visit_mode_consecutive'),
                    title: const Text('طلب زيارة متتابعة'),
                    subtitle: const Text(
                      'نفس الفرع، متتاليتان بالمدة (مثال: ٤٥ ثم ٣٠). تبقى طلبات حتى تؤكدها الجهة.',
                    ),
                    value: VisitBookingMode.consecutive,
                    groupValue: _mode,
                    onChanged: items.length < 2
                        ? null
                        : (v) => setState(() => _mode = v ?? VisitBookingMode.consecutive),
                  ),
                  RadioListTile<VisitBookingMode>(
                    key: const Key('visit_mode_separate'),
                    title: const Text('موعدان منفصلان'),
                    subtitle: const Text('تختارين لكل خدمة يومها ووقتها بنفسك — بلا فتح تلقائي للنموذج التالي.'),
                    value: VisitBookingMode.separate,
                    groupValue: _mode,
                    onChanged: (v) => setState(() => _mode = v ?? VisitBookingMode.separate),
                  ),
                  const SizedBox(height: 16),
                  if (_mode == VisitBookingMode.consecutive && items.length >= 2)
                    FilledButton(
                      key: const Key('basket_start_consecutive'),
                      onPressed: () => _openConsecutive(context, items),
                      child: const Text('خططي الزيارة المتتابعة'),
                    )
                  else ...[
                    Text(
                      'اطلبي موعد كل خدمة عند جاهزيتك — الرجوع لا يفتح النموذج التالي.',
                      style: AppTypography.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    for (final s in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: OutlinedButton(
                          key: Key('basket_book_separate_${s.id}'),
                          onPressed: !s.bookingEnabled || _submittedIds.contains(s.id)
                              ? null
                              : () => _openSeparateOne(context, s.id),
                          child: Text(
                            _submittedIds.contains(s.id)
                                ? 'طُلب: ${s.nameAr}'
                                : !s.bookingEnabled
                                    ? 'متوقفة: ${s.nameAr}'
                                    : 'اطلبي موعد: ${s.nameAr}',
                          ),
                        ),
                      ),
                  ],
                ],
              ),
      ),
    );
  }

  Future<void> _openConsecutive(BuildContext context, List items) async {
    final services = BookingBasket.instance.items;
    if (services.length < 2) return;
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookingVisitConsecutiveScreen(
          services: services,
          client: widget.client,
        ),
      ),
    );
    if (result == true && mounted) {
      setState(() {
        for (final s in services) {
          _submittedIds.add(s.id);
        }
      });
    }
  }

  Future<void> _openSeparateOne(BuildContext context, String serviceId) async {
    final match = BookingBasket.instance.items.where((s) => s.id == serviceId).toList();
    if (match.isEmpty) return;
    final s = match.first;
    if (!s.bookingEnabled) return;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookingRequestScreen(
          service: s,
          client: widget.client,
          visitPlan: {
            'mode': 'separate',
            'groupId': newIdempotencyKey(),
            'sequence': 1,
            'peerServiceIds': [s.id],
          },
          popResultOnSuccess: true,
        ),
      ),
    );
    // Cancel / back → null/false: do NOT open the next service.
    if (ok == true && mounted) {
      setState(() => _submittedIds.add(s.id));
    }
  }
}
