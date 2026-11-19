import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_price.dart';
import '../booking_basket.dart';
import 'booking_request_screen.dart';

enum _VisitMode { consecutive, separate }

/// «حجزك» — review selected services, then book consecutive or separate slots.
class BookingBasketScreen extends StatefulWidget {
  const BookingBasketScreen({super.key});

  @override
  State<BookingBasketScreen> createState() => _BookingBasketScreenState();
}

class _BookingBasketScreenState extends State<BookingBasketScreen> {
  _VisitMode _mode = _VisitMode.consecutive;

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
                          ].join(' · '),
                          style: AppTypography.bodySmall,
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => setState(() => basket.remove(s.id)),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text('ترتيب الزيارة', style: AppTypography.titleSmall),
                  RadioListTile<_VisitMode>(
                    key: const Key('visit_mode_consecutive'),
                    title: const Text('موعدان متتابعان (نفس الزيارة)'),
                    subtitle: const Text('عندما يتوفر وقت متصل لنفس الفرع'),
                    value: _VisitMode.consecutive,
                    groupValue: _mode,
                    onChanged: items.length < 2
                        ? null
                        : (v) => setState(() => _mode = v ?? _VisitMode.consecutive),
                  ),
                  RadioListTile<_VisitMode>(
                    key: const Key('visit_mode_separate'),
                    title: const Text('موعدان منفصلان'),
                    value: _VisitMode.separate,
                    groupValue: _mode,
                    onChanged: (v) => setState(() => _mode = v ?? _VisitMode.separate),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    key: const Key('basket_start_booking'),
                    onPressed: items.isEmpty
                        ? null
                        : () => _startBooking(context, items),
                    child: Text(
                      items.length >= 2
                          ? (_mode == _VisitMode.consecutive
                              ? 'ابدئي الحجز المتتابع'
                              : 'احجزي كل خدمة على حدة')
                          : 'احجزي الخدمة',
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Future<void> _startBooking(BuildContext context, List items) async {
    final services = BookingBasket.instance.items;
    if (services.isEmpty) return;
    // One CommerceBooking per service (idempotent keys). Mode is a visit plan hint:
    // consecutive = book in order same day when possible; separate = still sequential UX.
    for (final service in services) {
      if (!service.bookingEnabled) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('«${service.nameAr}» لم تعد قابلة للحجز')),
        );
        continue;
      }
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => BookingRequestScreen(service: service),
        ),
      );
    }
  }
}
