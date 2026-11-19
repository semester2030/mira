import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../data/pending_visit_attempt_store.dart';
import '../../domain/entities/catalog_service.dart';
import '../booking_basket.dart';
import 'booking_request_screen.dart';
import 'booking_visit_consecutive_screen.dart';

enum VisitBookingMode { consecutive, separate }

/// «حجزك» — consecutive visit plan vs separate appointment *requests*.
class BookingBasketScreen extends StatefulWidget {
  const BookingBasketScreen({super.key, this.client, this.pendingStore});

  final CommerceClient? client;
  final PendingVisitAttemptStore? pendingStore;

  @override
  State<BookingBasketScreen> createState() => _BookingBasketScreenState();
}

class _BookingBasketScreenState extends State<BookingBasketScreen> {
  VisitBookingMode _mode = VisitBookingMode.consecutive;
  final Set<String> _submittedIds = {};
  /// Explicit consecutive pair when basket has 3+ (never auto-reuse submitted ids).
  final List<String> _consecutivePick = [];

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

  List<CatalogService> get _unsent {
    return BookingBasket.instance.items.where((s) => !_submittedIds.contains(s.id)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final basket = BookingBasket.instance;
    final items = basket.items;
    final unsent = _unsent;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'رتّبي زيارتك'),
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
                            if ((s.branchNameAr ?? '').trim().isNotEmpty) s.branchNameAr!.trim(),
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
                    onChanged: unsent.length < 2
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
                  if (_mode == VisitBookingMode.consecutive && unsent.length >= 2) ...[
                    if (unsent.length > 2) ...[
                      Text(
                        'اختاري خدمتين غير مُرسلتين للزيارة المتتابعة، وراجعي الفرع قبل التأكيد.',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 8),
                      for (final s in unsent)
                        CheckboxListTile(
                          key: Key('consecutive_pick_${s.id}'),
                          value: _consecutivePick.contains(s.id),
                          title: Text(s.nameAr),
                          subtitle: Text(
                            [
                              if ((s.branchNameAr ?? s.branchId ?? '').toString().trim().isNotEmpty)
                                'الفرع: ${(s.branchNameAr ?? s.branchId)!.trim()}',
                              '${s.durationMin} د',
                            ].join(' · '),
                          ),
                          onChanged: (checked) {
                            setState(() {
                              if (checked == true) {
                                if (_consecutivePick.length >= 2) {
                                  _consecutivePick.removeAt(0);
                                }
                                if (!_consecutivePick.contains(s.id)) _consecutivePick.add(s.id);
                              } else {
                                _consecutivePick.remove(s.id);
                              }
                            });
                          },
                        ),
                    ],
                    FilledButton(
                      key: const Key('basket_start_consecutive'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.brandBurgundy,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed: () => _openConsecutive(context, unsent),
                      child: const Text('خططي الزيارة المتتابعة'),
                    ),
                  ] else ...[
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

  Future<void> _openConsecutive(BuildContext context, List<CatalogService> unsent) async {
    List<CatalogService> pair;
    if (unsent.length == 2) {
      pair = unsent;
    } else {
      if (_consecutivePick.length != 2) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('اختاري خدمتين غير مُرسلتين قبل المتابعة')),
        );
        return;
      }
      pair = [
        for (final id in _consecutivePick) unsent.firstWhere((s) => s.id == id),
      ];
    }
    // Shared branch preview before leaving the basket.
    final a = (pair[0].branchId ?? '').trim();
    final b = (pair[1].branchId ?? '').trim();
    final shared = a.isNotEmpty && b.isNotEmpty ? (a == b ? a : null) : (a.isNotEmpty ? a : (b.isNotEmpty ? b : null));
    final branchName = pair[0].branchNameAr ?? pair[1].branchNameAr ?? shared ?? '—';
    if (shared == null && a.isNotEmpty && b.isNotEmpty && a != b) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لا يوجد فرع مشترك — استخدمي المواعيد المنفصلة')),
      );
      return;
    }
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد الخدمتين'),
        content: Text('«${pair[0].nameAr}» ثم «${pair[1].nameAr}»\nالفرع: $branchName'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('رجوع')),
          FilledButton(
            key: const Key('confirm_consecutive_pair'),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('متابعة'),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;

    final nav = Navigator.of(context);
    final result = await nav.push<Set<String>>(
      MaterialPageRoute(
        builder: (_) => BookingVisitConsecutiveScreen(
          services: pair,
          client: widget.client,
          pendingStore: widget.pendingStore,
        ),
      ),
    );
    if (result != null && result.isNotEmpty && mounted) {
      setState(() {
        _submittedIds.addAll(result);
        _consecutivePick.removeWhere(_submittedIds.contains);
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
