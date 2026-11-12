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
import '../../data/discover_availability_context.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/saudi_cities.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/commerce_common.dart';

/// Pick a day and slot, then send a booking *request*. The partner must confirm it.
class BookingRequestScreen extends StatefulWidget {
  const BookingRequestScreen({
    super.key,
    required this.service,
    this.client,
    this.now,
    this.initialDateKey,
    this.initialBranchId,
    this.availabilityContext,
    this.discoverLane,
  });

  final CatalogService service;
  final CommerceClient? client;

  /// Test hook for the list of selectable days.
  final DateTime Function()? now;

  /// Discover filter context: YYYY-MM-DD when the user filtered by availableOn.
  final String? initialDateKey;

  /// Discover filter context: branch id when the user filtered by branch.
  final String? initialBranchId;
  final DiscoverAvailabilityContext? availabilityContext;
  final DiscoverLane? discoverLane;

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
  final _visitAddress = TextEditingController();

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

  /// branch | home — resolved from service + discover context.
  String? _placeMode;
  String? _visitCityId;

  CatalogService get service => widget.service;

  bool get _allowsEither => service.placeMode == 'either';
  bool get _needsPlaceChoice =>
      _allowsEither || service.placeMode == 'branch' || service.placeMode == 'home' || service.isIndependent;

  @override
  void initState() {
    super.initState();
    final start = riyadhTime((widget.now ?? DateTime.now)());
    _dates = [for (var i = 0; i < _days; i++) DateTime.utc(start.year, start.month, start.day).add(Duration(days: i))];
    final preferred = widget.initialDateKey;
    if (preferred != null && preferred.length == 10) {
      final idx = _dates.indexWhere((d) => _dateKey(d) == preferred);
      if (idx >= 0) _dateIndex = idx;
    }
    _placeMode = _resolveInitialPlaceMode();
    _visitCityId = widget.availabilityContext?.visitCityId ?? resolveSaudiCity(service.city)?.id;
    if (_visitCityId == null && service.coverageCityIds.length == 1) {
      _visitCityId = service.coverageCityIds.first;
    }
    if (!_client.signedIn) {
      _needsLogin = true;
    } else {
      _loadSlots();
    }
  }

  String? _resolveInitialPlaceMode() {
    final serviceMode = service.placeMode;
    final ctxMode = widget.availabilityContext?.placeMode;
    if (serviceMode == 'branch' || serviceMode == 'home') return serviceMode;
    if (serviceMode == 'either') {
      if (ctxMode == 'home' || ctxMode == 'branch') return ctxMode;
      if ((widget.initialBranchId ?? service.branchId)?.isNotEmpty == true) return 'branch';
      return 'branch';
    }
    if (ctxMode == 'home' || ctxMode == 'branch') return ctxMode;
    if (service.isIndependent) return 'home';
    if ((widget.initialBranchId ?? service.branchId)?.isNotEmpty == true) return 'branch';
    return null;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    _visitAddress.dispose();
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

  List<SaudiCity> get _visitCities {
    final covered = service.coverageCityIds;
    if (covered.isEmpty) return List<SaudiCity>.from(kSaudiCities);
    final matched = <SaudiCity>[];
    for (final id in covered) {
      final city = resolveSaudiCity(id);
      if (city != null) matched.add(city);
    }
    return matched.isEmpty ? List<SaudiCity>.from(kSaudiCities) : matched;
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

    final placeMode = _placeMode;
    final branchId = placeMode == 'branch' ? (widget.initialBranchId ?? service.branchId) : null;
    final visitCityId = placeMode == 'home' ? _visitCityId : null;
    final visitAddress = placeMode == 'home' ? _visitAddress.text.trim() : null;
    final travelFee = placeMode == 'home' ? service.travelFeeHalalas : null;

    if (placeMode == 'branch' && (branchId == null || branchId.isEmpty)) {
      setState(() => _submitError = 'اختاري فرعًا من التصفية أو من تفاصيل الخدمة.');
      return;
    }
    if (placeMode == 'home') {
      if (visitCityId == null || visitCityId.isEmpty) {
        setState(() => _submitError = 'اختاري مدينة الزيارة.');
        return;
      }
      if (visitAddress == null || visitAddress.isEmpty) {
        setState(() => _submitError = 'أدخلي عنوان الزيارة.');
        return;
      }
    }

    final signature =
        '${service.id}|${slot.resourceId}|${slot.startsAt.toIso8601String()}|${_name.text.trim()}|$phone|${_notes.text.trim()}|$placeMode|$branchId|$visitCityId|$visitAddress|$travelFee';
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
        resourceId: slot.resourceId,
        notes: _notes.text,
        placeMode: placeMode,
        branchId: branchId,
        visitCityId: visitCityId,
        visitAddress: visitAddress,
        travelFeeHalalas: travelFee,
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
    if (!service.bookingEnabled) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(MarketplaceCopy.appointmentUnavailable, textAlign: TextAlign.center)));
    }
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredBookings);
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(service.nameAr, style: AppTypography.headlineSmall, textAlign: TextAlign.center),
          Text(service.partnerNameAr, style: AppTypography.titleMedium, textAlign: TextAlign.center),
          if (widget.initialDateKey != null ||
              widget.initialBranchId != null ||
              widget.availabilityContext?.hasOccasionOfferContext == true) ...[
            const SizedBox(height: 8),
            Text(
              [
                if (widget.initialDateKey != null) 'التاريخ المختار: ${widget.initialDateKey}',
                if (widget.initialBranchId != null) 'الفرع: ${widget.initialBranchId}',
                if (widget.availabilityContext?.occasionServiceOffers.isNotEmpty == true)
                  'عرض الخدمة: ${widget.availabilityContext!.occasionServiceOffers.join('، ')}',
                if (widget.availabilityContext?.occasionTypeIds.isNotEmpty == true)
                  'المناسبة: ${widget.availabilityContext!.occasionTypeIds.join('، ')}',
              ].where((s) => s.isNotEmpty).join(' · '),
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 8),
          Text(
            '${service.durationMin > 0 ? 'المدة ${service.durationMin} د · ' : ''}${CatalogPrice.text(known: service.priceKnown, halalas: service.priceHalalas)}',
            style: AppTypography.bodyMedium,
            textAlign: TextAlign.center,
          ),
          Text(MarketplaceCopy.bookingPayAtVenue, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.center),
          if (_needsPlaceChoice) ...[
            const SizedBox(height: 16),
            Text('مكان الخدمة', style: AppTypography.titleMedium),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                if (_allowsEither || service.placeMode == 'branch' || _placeMode == 'branch')
                  ChoiceChip(
                    key: const ValueKey('place-branch'),
                    selected: _placeMode == 'branch',
                    label: const Text('في المقر'),
                    onSelected: _allowsEither || service.placeMode == 'either'
                        ? (_) => setState(() => _placeMode = 'branch')
                        : null,
                  ),
                if (_allowsEither || service.placeMode == 'home' || service.isIndependent || _placeMode == 'home')
                  ChoiceChip(
                    key: const ValueKey('place-home'),
                    selected: _placeMode == 'home',
                    label: const Text('في موقعك'),
                    onSelected: _allowsEither || service.placeMode == 'either' || service.isIndependent
                        ? (_) => setState(() => _placeMode = 'home')
                        : null,
                  ),
              ],
            ),
            if (_placeMode == 'branch' && (widget.initialBranchId ?? service.branchId) != null) ...[
              const SizedBox(height: 8),
              Text(
                'الفرع: ${widget.initialBranchId ?? service.branchId}',
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            if (_placeMode == 'home') ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: const ValueKey('visit-city'),
                value: _visitCities.any((c) => c.id == _visitCityId) ? _visitCityId : null,
                decoration: const InputDecoration(labelText: 'مدينة الزيارة'),
                items: [
                  for (final city in _visitCities)
                    DropdownMenuItem(value: city.id, child: Text(city.nameAr)),
                ],
                onChanged: (v) => setState(() => _visitCityId = v),
                validator: (v) => (v == null || v.isEmpty) ? 'اختاري مدينة الزيارة' : null,
              ),
              TextFormField(
                key: const ValueKey('visit-address'),
                controller: _visitAddress,
                decoration: const InputDecoration(labelText: 'عنوان الزيارة'),
                validator: (value) =>
                    _placeMode == 'home' && (value == null || value.trim().isEmpty) ? 'عنوان الزيارة مطلوب' : null,
              ),
              if (service.travelFeeHalalas != null && service.travelFeeHalalas! > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'رسوم التنقل: ${CatalogPrice.text(known: true, halalas: service.travelFeeHalalas!)}',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ],
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
            key: ValueKey('slot-${slot.resourceId}-${slot.startsAt.toIso8601String()}'),
            selected: _slot?.startsAt == slot.startsAt && _slot?.resourceId == slot.resourceId,
            label: Text(
              slot.resourceId.isEmpty
                  ? riyadhClock(slot.startsAt)
                  : '${riyadhClock(slot.startsAt)} · ${slot.resourceId}',
            ),
            onSelected: slot.available ? (_) => setState(() => _slot = slot) : null,
          ),
      ],
    );
  }
}
