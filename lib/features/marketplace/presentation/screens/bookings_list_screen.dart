import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/commerce_api_client.dart';
import '../../data/pending_visit_attempt_store.dart';
import '../../domain/commerce_models.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/commerce_common.dart';
import 'booking_visit_consecutive_screen.dart';

/// Customer bookings. A `requested` booking is a request, never described as confirmed.
class BookingsListScreen extends StatefulWidget {
  const BookingsListScreen({super.key, this.client, this.pendingStore});

  final CommerceClient? client;
  final PendingVisitAttemptStore? pendingStore;

  @override
  State<BookingsListScreen> createState() => _BookingsListScreenState();
}

class _BookingsListScreenState extends State<BookingsListScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  late final PendingVisitAttemptStore _pending = widget.pendingStore ?? PendingVisitAttemptStore();
  final _bookings = <CommerceBooking>[];
  List<PendingVisitAttempt> _pendingAttempts = const [];
  String? _cursor;
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;
  bool _needsLogin = false;
  String? _cancelling;
  String? _verifyingKey;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_client.signedIn) {
      setState(() {
        _needsLogin = true;
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await _client.listBookings();
      final account = _client.accountKey;
      final pendings = account == null || account.isEmpty
          ? <PendingVisitAttempt>[]
          : await _pending.list(account);
      if (!mounted) return;
      setState(() {
        _bookings
          ..clear()
          ..addAll(page.items);
        _cursor = page.nextCursor;
        _pendingAttempts = [
          for (final a in pendings)
            if (a.phase == VisitAttemptPhase.outcomeUnknown ||
                a.phase == VisitAttemptPhase.submitting ||
                a.phase == VisitAttemptPhase.rejectedFinal)
              a,
        ];
        _loading = false;
      });
    } on CommerceAuthException {
      if (mounted) {
        setState(() {
          _needsLogin = true;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = commerceErrorText(error);
          _loading = false;
        });
      }
    }
  }

  Future<void> _more() async {
    if (_loadingMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await _client.listBookings(cursor: _cursor);
      if (!mounted) return;
      setState(() {
        _bookings.addAll(page.items);
        _cursor = page.nextCursor;
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(error))));
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  CatalogService _stubService(PendingVisitAttempt attempt, int index) {
    final id = attempt.serviceIds.length > index ? attempt.serviceIds[index] : 'unknown-$index';
    final name = attempt.serviceNamesAr.length > index ? attempt.serviceNamesAr[index] : id;
    return CatalogService(
      id: id,
      partnerId: 'pending',
      partnerNameAr: attempt.branchLabel.isNotEmpty ? attempt.branchLabel : 'طلب معلّق',
      partnerType: 'salon',
      city: 'الرياض',
      nameAr: name,
      nameEn: id,
      durationMin: 30,
      priceHalalas: 0,
      priceLabel: '',
      priceKnown: false,
      matchScore: 0,
      bookingEnabled: true,
      branchId: attempt.branchId,
      branchNameAr: attempt.branchLabel,
    );
  }

  Future<void> _openPending(PendingVisitAttempt attempt) async {
    if (attempt.serviceIds.length < 2) return;
    final pair = [_stubService(attempt, 0), _stubService(attempt, 1)];
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BookingVisitConsecutiveScreen(
          services: pair,
          client: _client,
          pendingStore: _pending,
          resumeIdempotencyKey: attempt.idempotencyKey,
        ),
      ),
    );
    if (mounted) await _load();
  }

  Future<void> _verifyPending(PendingVisitAttempt attempt) async {
    final account = _client.accountKey;
    if (account == null || _verifyingKey != null) return;
    if (attempt.phase == VisitAttemptPhase.rejectedFinal) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('رُفض الطلب نهائيًا${attempt.rejectionCode != null ? ' (${attempt.rejectionCode})' : ''}. لن يُعاد الإرسال تلقائيًا.')),
      );
      return;
    }
    setState(() => _verifyingKey = attempt.idempotencyKey);
    try {
      final byKey = await _client.getVisitByKey(attempt.idempotencyKey);
      if (byKey != null) {
        await _pending.remove(account, attempt.idempotencyKey);
        if (!mounted) return;
        final lines = byKey.visit.bookings
            .map((b) => '«${b.serviceNameAr}» ${riyadhClock(b.startsAt)}–${riyadhClock(b.endsAt)}')
            .join('\n');
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('زيارة ${byKey.visit.publicNumber}'),
            content: Text('${byKey.visit.statusLabelAr}\n${byKey.visit.branchLabel ?? attempt.branchLabel}\n$lines'),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('حسنًا'))],
          ),
        );
        await _load();
        return;
      }
      // Key not found — open consecutive recovery (same key replay), never invent availability.
      await _openPending(attempt);
    } on CommerceApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لم نتحقق من نتيجة الطلب: ${e.messageAr}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(e))));
    } finally {
      if (mounted) setState(() => _verifyingKey = null);
    }
  }

  Future<void> _cancel(CommerceBooking booking) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إلغاء الموعد؟'),
        content: Text('سيُلغى ${booking.serviceNameAr} في ${riyadhDateTimeLabel(booking.startsAt)}.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('تراجع')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('إلغاء الموعد')),
        ],
      ),
    );
    if (ok != true || _cancelling != null) return;
    setState(() => _cancelling = booking.id);
    try {
      final updated = await _client.cancelBooking(booking.id);
      if (!mounted) return;
      setState(() {
        final at = _bookings.indexWhere((item) => item.id == booking.id);
        if (at >= 0) _bookings[at] = updated;
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(error))));
        _load();
      }
    } finally {
      if (mounted) setState(() => _cancelling = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'حجوزاتي'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredBookings);
    if (_error != null) return CommerceErrorRetry(message: _error!, onRetry: _load);
    if (_bookings.isEmpty && _pendingAttempts.isEmpty) {
      return Center(child: Text(MarketplaceCopy.noBookings, style: AppTypography.bodyLarge));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final attempt in _pendingAttempts)
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    attempt.phase == VisitAttemptPhase.rejectedFinal
                        ? 'طلب زيارة مرفوض'
                        : 'طلب زيارة بانتظار التحقق',
                    key: Key('pending_visit_${attempt.idempotencyKey}'),
                    style: AppTypography.titleMedium,
                  ),
                  Text(
                    attempt.serviceNamesAr.isNotEmpty
                        ? attempt.serviceNamesAr.join(' → ')
                        : attempt.serviceIds.join(' → '),
                    style: AppTypography.bodyMedium,
                  ),
                  Text(attempt.branchLabel.isNotEmpty ? attempt.branchLabel : attempt.branchId, style: AppTypography.bodySmall),
                  const SizedBox(height: 8),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: attempt.phase == VisitAttemptPhase.rejectedFinal
                        ? TextButton(
                            onPressed: () => _openPending(attempt),
                            child: const Text('عرض التفاصيل'),
                          )
                        : TextButton(
                            key: Key('verify_pending_${attempt.idempotencyKey}'),
                            onPressed: _verifyingKey == attempt.idempotencyKey
                                ? null
                                : () => _verifyPending(attempt),
                            child: Text(_verifyingKey == attempt.idempotencyKey ? 'جارٍ التحقق…' : 'تحققي من طلبي'),
                          ),
                  ),
                ],
              ),
            ),
          for (final booking in _bookings)
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text('حجز ${booking.publicNumber}', style: AppTypography.titleMedium)),
                      IconButton(
                        tooltip: 'نسخ الرقم',
                        onPressed: () async {
                          await Clipboard.setData(ClipboardData(text: booking.publicNumber));
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نُسخ رقم الحجز')));
                        },
                        icon: const Icon(Icons.copy, size: 18),
                      ),
                    ],
                  ),
                  Text(booking.serviceNameAr, style: AppTypography.bodyMedium),
                  Text(booking.partnerNameAr, style: AppTypography.bodySmall),
                  Text(booking.branchLabel, style: AppTypography.bodySmall),
                  const SizedBox(height: 6),
                  Text('الموعد: ${riyadhDateTimeLabel(booking.startsAt)}', style: AppTypography.bodyMedium),
                  Text(
                    '${CommerceLabels.money(booking.priceHalalas)} · الدفع في الفرع',
                    style: AppTypography.bodySmall,
                  ),
                  if (booking.nextActionAr != null && booking.nextActionAr!.isNotEmpty)
                    Text('الخطوة التالية: ${booking.nextActionAr}', style: AppTypography.bodySmall),
                  const SizedBox(height: 8),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: CommerceStatusChip(CommerceLabels.booking(booking.status), tone: bookingTone(booking.status)),
                  ),
                  if (booking.customerCanCancel)
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton(
                        onPressed: _cancelling == booking.id ? null : () => _cancel(booking),
                        child: const Text('إلغاء الموعد'),
                      ),
                    ),
                ],
              ),
            ),
          if (_cursor != null)
            TextButton(onPressed: _loadingMore ? null : _more, child: Text(_loadingMore ? 'جارٍ التحميل' : 'عرض المزيد')),
        ],
      ),
    );
  }
}
