import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/commerce_common.dart';

/// Pick a day and slot, then send a booking *request*. The partner must confirm it.
class BookingRequestScreen extends StatefulWidget {
  const BookingRequestScreen({super.key, required this.service, this.client, this.now});

  final CatalogService service;
  final CommerceClient? client;

  /// Test hook for the list of selectable days.
  final DateTime Function()? now;

  @override
  State<BookingRequestScreen> createState() => _BookingRequestScreenState();
}

class _BookingRequestScreenState extends State<BookingRequestScreen> {
  static const _days = 14;
  static const _weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();

  late final List<DateTime> _dates;
  int _dateIndex = 0;
  CommerceAvailability? _availability;
  CommerceSlot? _slot;
  String? _availabilityError;
  String? _submitError;
  bool _loadingSlots = false;
  bool _needsLogin = false;
  bool _submitting = false;
  int _slotRequest = 0;

  String? _idempotencyKey;
  String? _keySignature;

  CatalogService get service => widget.service;

  @override
  void initState() {
    super.initState();
    final start = riyadhTime((widget.now ?? DateTime.now)());
    _dates = [for (var i = 0; i < _days; i++) DateTime.utc(start.year, start.month, start.day).add(Duration(days: i))];
    if (!_client.signedIn) {
      _needsLogin = true;
    } else {
      _loadSlots();
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _dateKey(DateTime day) => '${day.year}-${twoDigits(day.month)}-${twoDigits(day.day)}';

  Future<void> _loadSlots() async {
    final request = ++_slotRequest;
    setState(() {
      _loadingSlots = true;
      _availabilityError = null;
      _availability = null;
      _slot = null;
    });
    try {
      final availability = await _client.availability(service.id, _dateKey(_dates[_dateIndex]));
      if (!mounted || request != _slotRequest) return;
      setState(() {
        _availability = availability;
        _loadingSlots = false;
      });
    } on CommerceAuthException {
      if (mounted && request == _slotRequest) {
        setState(() {
          _needsLogin = true;
          _loadingSlots = false;
        });
      }
    } catch (error) {
      if (mounted && request == _slotRequest) {
        setState(() {
          _availabilityError = commerceErrorText(error);
          _loadingSlots = false;
        });
      }
    }
  }

  Future<void> _confirm() async {
    if (_submitting) return;
    if (!_form.currentState!.validate()) return;
    final slot = _slot;
    if (slot == null) {
      setState(() => _submitError = 'اختاري موعدًا من القائمة.');
      return;
    }
    final phone = SaudiPhone.toE164(_phone.text);
    if (phone == null) return;
    final signature = '${service.id}|${slot.startsAt.toIso8601String()}|${_name.text.trim()}|$phone|${_notes.text.trim()}';
    if (_idempotencyKey == null || _keySignature != signature) {
      _idempotencyKey = newIdempotencyKey();
      _keySignature = signature;
    }
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final result = await _client.createBooking(
        idempotencyKey: _idempotencyKey!,
        serviceId: service.id,
        startsAt: slot.startsAt,
        contactName: _name.text.trim(),
        contactPhone: phone,
        notes: _notes.text,
      );
      _idempotencyKey = null;
      _keySignature = null;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text(MarketplaceCopy.bookingRequested)));
      await Navigator.of(context).pushReplacementNamed(AppRoutes.myBookings, arguments: result.booking.id);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (error) {
      if (!mounted) return;
      setState(() => _submitError = error.messageAr);
      // The slot may have just been taken: refresh the list so the customer sees the truth.
      if (error.code == 'BOOKING_SLOT_FULL' || error.code.startsWith('SLOT_')) _loadSlots();
    } catch (error) {
      if (mounted) setState(() => _submitError = commerceErrorText(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'طلب موعد'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredBookings);
    if (!service.bookingEnabled) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(MarketplaceCopy.appointmentUnavailable, textAlign: TextAlign.center)));
    }
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(service.nameAr, style: AppTypography.headlineSmall, textAlign: TextAlign.center),
          Text(service.partnerNameAr, style: AppTypography.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            '${service.durationMin > 0 ? 'المدة ${service.durationMin} د · ' : ''}${CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas)}',
            style: AppTypography.bodyMedium,
            textAlign: TextAlign.center,
          ),
          Text(MarketplaceCopy.bookingPayAtVenue, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          Text('اليوم', style: AppTypography.titleMedium),
          const SizedBox(height: 6),
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _dates.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final day = _dates[index];
                return ChoiceChip(
                  key: ValueKey('day-$index'),
                  selected: index == _dateIndex,
                  label: Text('${_weekdays[day.weekday % 7]}\n${day.day}/${day.month}', textAlign: TextAlign.center),
                  onSelected: (_) {
                    if (index == _dateIndex) return;
                    setState(() => _dateIndex = index);
                    _loadSlots();
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Text('الموعد', style: AppTypography.titleMedium),
          const SizedBox(height: 6),
          _slots(),
          const SizedBox(height: 16),
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'الاسم'),
            validator: (value) => (value == null || value.trim().length < 2) ? 'الاسم مطلوب' : null,
          ),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'رقم الجوال', hintText: '05xxxxxxxx'),
            validator: (value) => SaudiPhone.validateMessage(value ?? ''),
          ),
          TextFormField(
            controller: _notes,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
          ),
          if (_submitError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_submitError!, style: AppTypography.bodyMedium.copyWith(color: Colors.red.shade700)),
            ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _submitting || _slot == null ? null : _confirm,
            child: Text(_submitting ? 'جارٍ الإرسال' : 'إرسال طلب الموعد'),
          ),
          const SizedBox(height: 6),
          Text(
            'الطلب ليس حجزًا مؤكدًا. تؤكده الجهة أو ترفضه.',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _slots() {
    if (_loadingSlots) return const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()));
    if (_availabilityError != null) {
      return CommerceErrorRetry(message: _availabilityError!, onRetry: _loadSlots);
    }
    final availability = _availability;
    if (availability == null) return const SizedBox.shrink();
    if (availability.slots.isEmpty) {
      return PremiumCard(
        child: Text(
          service.availabilityPresent ? MarketplaceCopy.noSlotsForDay : MarketplaceCopy.availabilityMissing,
          style: AppTypography.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final slot in availability.slots)
          ChoiceChip(
            key: ValueKey('slot-${slot.startsAt.toIso8601String()}'),
            selected: _slot?.startsAt == slot.startsAt,
            label: Text(riyadhClock(slot.startsAt)),
            onSelected: slot.available ? (_) => setState(() => _slot = slot) : null,
          ),
      ],
    );
  }
}
