import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/commerce_common.dart';

/// Plan a consecutive visit *request* (same branch, back-to-back durations).
/// Partner still confirms — UI never says «مؤكد».
class BookingVisitConsecutiveScreen extends StatefulWidget {
  const BookingVisitConsecutiveScreen({
    super.key,
    required this.services,
    this.client,
  });

  final List<CatalogService> services;
  final CommerceClient? client;

  @override
  State<BookingVisitConsecutiveScreen> createState() => _BookingVisitConsecutiveScreenState();
}

class _BookingVisitConsecutiveScreenState extends State<BookingVisitConsecutiveScreen> {
  static const _days = 14;
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();

  late final List<DateTime> _dates;
  int _dateIndex = 0;
  CommerceAvailability? _firstAvailability;
  CommerceSlot? _firstSlot;
  String? _error;
  String? _blockReason;
  bool _loading = false;
  bool _submitting = false;
  bool _needsLogin = false;

  String? _groupId;
  final Map<String, String> _itemKeys = {};
  final Set<String> _succeededIds = {};

  CatalogService get _a => widget.services.first;
  CatalogService get _b => widget.services[1];

  String get _branchId => (_a.branchId ?? _b.branchId ?? '').trim();

  @override
  void initState() {
    super.initState();
    final start = riyadhTime(DateTime.now());
    _dates = [for (var i = 0; i < _days; i++) DateTime.utc(start.year, start.month, start.day).add(Duration(days: i))];
    _groupId = newIdempotencyKey();
    if (!_client.signedIn) {
      _needsLogin = true;
    } else {
      _loadFirstSlots();
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _dateKey(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _loadFirstSlots() async {
    setState(() {
      _loading = true;
      _error = null;
      _firstSlot = null;
      _blockReason = null;
    });
    try {
      final avail = await _client.availability(_a.id, _dateKey(_dates[_dateIndex]));
      if (!mounted) return;
      setState(() {
        _firstAvailability = avail;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = commerceErrorText(e);
      });
    }
  }

  Future<CommerceSlot?> _resolveSecondSlot(CommerceSlot first) async {
    final expectedStart = first.endsAt;
    final avail = await _client.availability(_b.id, _dateKey(_dates[_dateIndex]));
    for (final slot in avail.slots) {
      if (!slot.available) continue;
      final skew = slot.startsAt.difference(expectedStart).inSeconds.abs();
      if (skew <= 60) return slot;
    }
    return null;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_form.currentState!.validate()) return;
    final first = _firstSlot;
    if (first == null) {
      setState(() => _error = 'اختاري وقت بدء الخدمة الأولى');
      return;
    }
    if (_branchId.isEmpty) {
      setState(() => _error = 'الزيارة المتتابعة تتطلب فرعًا منشورًا على الخدمات');
      return;
    }
    if (!_a.bookingEnabled || !_b.bookingEnabled) {
      setState(() => _error = 'إحدى الخدمات متوقفة عن الحجز');
      return;
    }
    final phone = SaudiPhone.toE164(_phone.text);
    if (phone == null) return;

    setState(() {
      _submitting = true;
      _error = null;
      _blockReason = null;
    });
    try {
      final second = await _resolveSecondSlot(first);
      if (second == null) {
        setState(() {
          _submitting = false;
          _blockReason =
              'لا يتوفر وقت متصل للخدمة الثانية بعد ${first.endsAt.toLocal()}. اختاري وقتًا آخر أو مواعيد منفصلة.';
        });
        return;
      }

      final peers = [_a.id, _b.id];
      final planA = {
        'mode': 'consecutive',
        'groupId': _groupId,
        'sequence': 1,
        'peerServiceIds': peers,
        'branchId': _branchId,
        'expectedStartsAt': first.startsAt.toUtc().toIso8601String(),
        'expectedEndsAt': first.endsAt.toUtc().toIso8601String(),
      };
      final planB = {
        'mode': 'consecutive',
        'groupId': _groupId,
        'sequence': 2,
        'peerServiceIds': peers,
        'branchId': _branchId,
        'expectedStartsAt': second.startsAt.toUtc().toIso8601String(),
        'expectedEndsAt': second.endsAt.toUtc().toIso8601String(),
      };

      _itemKeys[_a.id] ??= newIdempotencyKey();
      if (!_succeededIds.contains(_a.id)) {
        await _client.createBooking(
          idempotencyKey: _itemKeys[_a.id]!,
          serviceId: _a.id,
          startsAt: first.startsAt,
          contactName: _name.text.trim(),
          contactPhone: phone,
          resourceId: first.resourceId,
          notes: _notes.text,
          placeMode: 'branch',
          branchId: _branchId,
          visitPlan: planA,
        );
        _succeededIds.add(_a.id);
      }

      _itemKeys[_b.id] ??= newIdempotencyKey();
      if (!_succeededIds.contains(_b.id)) {
        await _client.createBooking(
          idempotencyKey: _itemKeys[_b.id]!,
          serviceId: _b.id,
          startsAt: second.startsAt,
          contactName: _name.text.trim(),
          contactPhone: phone,
          resourceId: second.resourceId,
          notes: _notes.text,
          placeMode: 'branch',
          branchId: _branchId,
          visitPlan: planB,
        );
        _succeededIds.add(_b.id);
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أُرسل طلب الزيارة المتتابعة — بانتظار رد المركز (ليس تأكيدًا).')),
      );
      Navigator.of(context).pop(true);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (e) {
      if (!mounted) return;
      // Do not clear succeeded item keys — retry must not re-create the first row.
      setState(() => _error = e.messageAr);
    } catch (e) {
      if (mounted) setState(() => _error = commerceErrorText(e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_needsLogin) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'طلب زيارة متتابعة'),
        body: const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredBookings),
      );
    }
    final secondPreview = _firstSlot == null
        ? null
        : (
            start: _firstSlot!.endsAt,
            end: _firstSlot!.endsAt.add(Duration(minutes: _b.durationMin > 0 ? _b.durationMin : 30)),
          );

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'طلب زيارة متتابعة'),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'هذا طلب مواعيد متتابعة يراجعه المركز — ليس حجزًا مؤكدًا.',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text('${_a.nameAr} → ${_b.nameAr}', style: AppTypography.titleMedium, textAlign: TextAlign.center),
              Text(_a.partnerNameAr, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
              if (_branchId.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'لا يوجد فرع منشور على الخدمات — لا يمكن إنشاء زيارة متتابعة. استخدمي المواعيد المنفصلة.',
                    style: AppTypography.bodySmall.copyWith(color: Colors.red.shade700),
                    textAlign: TextAlign.center,
                  ),
                ),
              const SizedBox(height: 16),
              Text('اليوم', style: AppTypography.titleSmall),
              SizedBox(
                height: 48,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _dates.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final selected = i == _dateIndex;
                    return ChoiceChip(
                      label: Text(_dateKey(_dates[i])),
                      selected: selected,
                      onSelected: (_) {
                        setState(() => _dateIndex = i);
                        _loadFirstSlots();
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Text('وقت بدء ${_a.nameAr} (${_a.durationMin} د)', style: AppTypography.titleSmall),
              if (_loading) const LinearProgressIndicator(),
              if (_firstAvailability != null)
                Wrap(
                  spacing: 8,
                  children: [
                    for (final slot in _firstAvailability!.slots.where((s) => s.available))
                      ChoiceChip(
                        label: Text(
                          '${TimeOfDay.fromDateTime(slot.startsAt.toLocal()).format(context)}'
                          '–${TimeOfDay.fromDateTime(slot.endsAt.toLocal()).format(context)}',
                        ),
                        selected: _firstSlot?.startsAt == slot.startsAt,
                        onSelected: (_) => setState(() {
                          _firstSlot = slot;
                          _blockReason = null;
                        }),
                      ),
                  ],
                ),
              if (secondPreview != null) ...[
                const SizedBox(height: 12),
                Text(
                  'ثم ${_b.nameAr} (${_b.durationMin} د): '
                  '${TimeOfDay.fromDateTime(secondPreview.start.toLocal()).format(context)}'
                  '–${TimeOfDay.fromDateTime(secondPreview.end.toLocal()).format(context)} '
                  '· ${CatalogPrice.text(known: _b.priceKnown, halalas: _b.priceHalalas)}',
                  style: AppTypography.bodyMedium,
                ),
              ],
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'الاسم'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
              ),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(labelText: 'الجوال'),
                validator: (v) => SaudiPhone.toE164(v ?? '') == null ? 'رقم غير صالح' : null,
              ),
              TextFormField(
                controller: _notes,
                decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
              ),
              if (_blockReason != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_blockReason!, style: TextStyle(color: Colors.orange.shade800)),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade700)),
                ),
              const SizedBox(height: 16),
              FilledButton(
                key: const Key('submit_consecutive_visit'),
                onPressed: _submitting || _branchId.isEmpty ? null : _submit,
                child: Text(_submitting ? 'جارٍ الإرسال' : 'إرسال طلب الزيارة المتتابعة'),
              ),
              if (_succeededIds.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'بُنود نُفّذت في هذه المحاولة: ${_succeededIds.length} — لن تُعاد عند إعادة المحاولة.',
                    style: AppTypography.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
