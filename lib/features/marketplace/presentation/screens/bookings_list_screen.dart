import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../widgets/commerce_common.dart';

/// Customer bookings. A `requested` booking is a request, never described as confirmed.
class BookingsListScreen extends StatefulWidget {
  const BookingsListScreen({super.key, this.client});

  final CommerceClient? client;

  @override
  State<BookingsListScreen> createState() => _BookingsListScreenState();
}

class _BookingsListScreenState extends State<BookingsListScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  final _bookings = <CommerceBooking>[];
  String? _cursor;
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;
  bool _needsLogin = false;
  String? _cancelling;

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
      if (!mounted) return;
      setState(() {
        _bookings
          ..clear()
          ..addAll(page.items);
        _cursor = page.nextCursor;
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
    if (_bookings.isEmpty) return Center(child: Text(MarketplaceCopy.noBookings, style: AppTypography.bodyLarge));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final booking in _bookings)
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('حجز ${booking.publicNumber}', style: AppTypography.titleMedium),
                  Text(booking.serviceNameAr, style: AppTypography.bodyMedium),
                  Text(booking.branchLabel, style: AppTypography.bodySmall),
                  const SizedBox(height: 6),
                  Text('الموعد: ${riyadhDateTimeLabel(booking.startsAt)}', style: AppTypography.bodyMedium),
                  Text(
                    '${CommerceLabels.money(booking.priceHalalas)} · الدفع في الفرع',
                    style: AppTypography.bodySmall,
                  ),
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
