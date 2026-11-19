import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../data/pending_visit_attempt_store.dart';
import '../../domain/commerce_models.dart';
import '../../domain/entities/catalog_service.dart';
import '../widgets/commerce_common.dart';

/// Consecutive visit = one server operation (exactly two chosen services).
/// Creates appointment *requests* awaiting partner reply — never «مؤكد».
class BookingVisitConsecutiveScreen extends StatefulWidget {
  const BookingVisitConsecutiveScreen({
    super.key,
    required this.services,
    this.client,
    this.pendingStore,
  });

  /// Exactly two services the customer selected for this visit.
  final List<CatalogService> services;
  final CommerceClient? client;
  final PendingVisitAttemptStore? pendingStore;

  @override
  State<BookingVisitConsecutiveScreen> createState() => _BookingVisitConsecutiveScreenState();
}

class _BookingVisitConsecutiveScreenState extends State<BookingVisitConsecutiveScreen> {
  static const _days = 14;
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  late final PendingVisitAttemptStore _pending = widget.pendingStore ?? PendingVisitAttemptStore();
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
  bool _recovering = false;

  String? _idempotencyKey;
  String? _completedVisitId;
  String? _completedPublicNumber;
  List<String> _acceptedServiceIds = const [];
  PendingVisitAttempt? _pendingAttempt;

  CatalogService get _a => widget.services.first;
  CatalogService get _b => widget.services[1];

  String? get _sharedBranchId {
    final a = (_a.branchId ?? '').trim();
    final b = (_b.branchId ?? '').trim();
    if (a.isNotEmpty && b.isNotEmpty) return a == b ? a : null;
    if (a.isNotEmpty && b.isEmpty) return a;
    if (b.isNotEmpty && a.isEmpty) return b;
    return null;
  }

  String get _branchLabel {
    final id = _sharedBranchId;
    if (id == null) return '';
    final name = _a.branchNameAr ?? _b.branchNameAr;
    return (name != null && name.trim().isNotEmpty) ? name.trim() : id;
  }

  @override
  void initState() {
    super.initState();
    assert(widget.services.length == 2);
    final start = riyadhTime(DateTime.now());
    _dates = [for (var i = 0; i < _days; i++) DateTime.utc(start.year, start.month, start.day).add(Duration(days: i))];
    _idempotencyKey = newIdempotencyKey();
    if (!_client.signedIn) {
      _needsLogin = true;
    } else {
      _bootstrap();
    }
  }

  Future<void> _bootstrap() async {
    await _tryRecoverPending();
    if (_completedVisitId != null) return;
    await _loadFirstSlots();
  }

  Future<void> _tryRecoverPending() async {
    final account = _client.accountKey;
    if (account == null || account.isEmpty) return;
    final pending = await _pending.load(account);
    if (pending == null) return;
    // Only recover when the pending attempt matches this pair of services.
    final pendingIds = pending.items.map((e) => e['serviceId'] as String?).whereType<String>().toSet();
    final screenIds = {_a.id, _b.id};
    if (pendingIds.length != 2 || pendingIds.difference(screenIds).isNotEmpty) return;

    setState(() {
      _recovering = true;
      _pendingAttempt = pending;
      _idempotencyKey = pending.idempotencyKey;
      _name.text = pending.contactName;
      _phone.text = SaudiPhone.display(pending.contactPhone);
      if (pending.notes != null) _notes.text = pending.notes!;
    });

    try {
      // Prefer lookup by key — do NOT treat availability as a receipt.
      final byKey = await _client.getVisitByKey(pending.idempotencyKey);
      if (byKey != null) {
        await _applyVisitResult(byKey.visit, clearPending: true);
        return;
      }
      // Unknown outcome: re-POST the same key + same body (idempotent replay or first write).
      final result = await _client.createConsecutiveVisit(
        idempotencyKey: pending.idempotencyKey,
        branchId: pending.branchId,
        contactName: pending.contactName,
        contactPhone: pending.contactPhone,
        items: pending.items,
        notes: pending.notes,
      );
      await _applyVisitResult(result.visit, clearPending: true);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (e) {
      if (mounted) setState(() => _error = e.messageAr);
    } catch (e) {
      if (mounted) setState(() => _error = commerceErrorText(e));
    } finally {
      if (mounted) setState(() => _recovering = false);
    }
  }

  Future<void> _applyVisitResult(CommerceVisit visit, {required bool clearPending}) async {
    _completedVisitId = visit.id;
    _completedPublicNumber = visit.publicNumber;
    _acceptedServiceIds = visit.bookings.map((b) => b.serviceId).toList();
    if (clearPending) {
      final account = _client.accountKey;
      if (account != null) await _pending.clear(account);
    }
    if (!mounted) return;
    setState(() {});
    final lines = visit.bookings
        .map((b) => '«${b.serviceNameAr}» ${riyadhClock(b.startsAt)}–${riyadhClock(b.endsAt)}')
        .join('\n');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'طُلبت الزيارة ${visit.publicNumber} — ${visit.statusLabelAr}\n'
          '${visit.branchLabel ?? _branchLabel}\n$lines',
        ),
        duration: const Duration(seconds: 5),
      ),
    );
    Navigator.of(context).pop(Set<String>.from(_acceptedServiceIds));
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

  Future<CommerceSlot?> _previewSecond(CommerceSlot first) async {
    final expectedStart = first.endsAt;
    final avail = await _client.availability(_b.id, _dateKey(_dates[_dateIndex]));
    for (final slot in avail.slots) {
      if (!slot.available) continue;
      if (slot.startsAt.difference(expectedStart).inSeconds.abs() <= 60) return slot;
    }
    return null;
  }

  Future<void> _submit() async {
    if (_submitting || _recovering) return;
    if (_completedVisitId != null) {
      Navigator.of(context).pop(<String>{..._acceptedServiceIds});
      return;
    }
    if (!_form.currentState!.validate()) return;
    final first = _firstSlot;
    if (first == null) {
      setState(() => _error = 'اختاري وقت بدء الخدمة الأولى');
      return;
    }
    final branchId = _sharedBranchId;
    if (branchId == null || branchId.isEmpty) {
      setState(() => _error = 'لا يوجد فرع مشترك منشور للخدمتين — استخدمي المواعيد المنفصلة');
      return;
    }
    if (!_a.bookingEnabled || !_b.bookingEnabled) {
      setState(() => _error = 'إحدى الخدمات متوقفة عن الحجز');
      return;
    }
    final phone = SaudiPhone.toE164(_phone.text);
    if (phone == null) return;
    final account = _client.accountKey;
    if (account == null || account.isEmpty) {
      setState(() => _needsLogin = true);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _blockReason = null;
    });
    try {
      final second = await _previewSecond(first);
      if (second == null) {
        setState(() {
          _submitting = false;
          _blockReason =
              'لا يتوفر وقت متصل للخدمة الثانية بعد ${riyadhClock(first.endsAt)}. اختاري وقتًا آخر أو مواعيد منفصلة.';
        });
        return;
      }

      _idempotencyKey ??= newIdempotencyKey();
      final items = [
        {
          'serviceId': _a.id,
          'startsAt': first.startsAt.toUtc().toIso8601String(),
          if (first.resourceId.isNotEmpty) 'resourceId': first.resourceId,
        },
        {
          'serviceId': _b.id,
          'startsAt': second.startsAt.toUtc().toIso8601String(),
          if (second.resourceId.isNotEmpty) 'resourceId': second.resourceId,
        },
      ];
      final fp = pendingVisitFingerprint(branchId: branchId, items: items);
      // Persist *before* the first send so a lost success can be recovered by key.
      final attempt = PendingVisitAttempt(
        userId: account,
        idempotencyKey: _idempotencyKey!,
        fingerprint: fp,
        branchId: branchId,
        items: items,
        contactName: _name.text.trim(),
        contactPhone: phone,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        savedAtMs: DateTime.now().millisecondsSinceEpoch,
      );
      await _pending.save(attempt);
      _pendingAttempt = attempt;

      final result = await _client.createConsecutiveVisit(
        idempotencyKey: _idempotencyKey!,
        branchId: branchId,
        contactName: attempt.contactName,
        contactPhone: attempt.contactPhone,
        notes: attempt.notes,
        items: items,
      );
      await _applyVisitResult(result.visit, clearPending: true);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (e) {
      if (!mounted) return;
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
    final secondEnd = _firstSlot == null
        ? null
        : _firstSlot!.endsAt.add(Duration(minutes: _b.durationMin > 0 ? _b.durationMin : 30));

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
                'طلب واحد للمركز يضم الخدمتين معًا — بانتظار رد المركز (ليس تأكيدًا).',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              if (_recovering || _pendingAttempt != null && _completedVisitId == null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _recovering ? 'جارٍ استرجاع طلب الزيارة…' : 'توجد محاولة سابقة — نعيد الاستعلام بالمفتاح دون فحص توفر جديد أولًا.',
                    style: AppTypography.bodySmall.copyWith(color: Colors.orange.shade800),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (_completedPublicNumber != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'مرجع الطلب: $_completedPublicNumber — طلب بانتظار رد المركز',
                    style: AppTypography.titleSmall,
                    textAlign: TextAlign.center,
                  ),
                ),
              const SizedBox(height: 12),
              Text('${_a.nameAr} → ${_b.nameAr}', style: AppTypography.titleMedium, textAlign: TextAlign.center),
              Text(_a.partnerNameAr, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
              Text(
                _sharedBranchId == null ? 'لا يوجد فرع مشترك منشور' : 'الفرع: $_branchLabel',
                style: AppTypography.bodyMedium.copyWith(
                  color: _sharedBranchId == null ? Colors.red.shade700 : AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text('اليوم (توقيت الرياض)', style: AppTypography.titleSmall),
              SizedBox(
                height: 48,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _dates.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    return ChoiceChip(
                      label: Text(_dateKey(_dates[i])),
                      selected: i == _dateIndex,
                      onSelected: _recovering
                          ? null
                          : (_) {
                              setState(() => _dateIndex = i);
                              _idempotencyKey = newIdempotencyKey();
                              _loadFirstSlots();
                            },
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Text('وقت بدء ${_a.nameAr} (${_a.durationMin} د) — توقيت الرياض', style: AppTypography.titleSmall),
              if (_loading) const LinearProgressIndicator(),
              if (_firstAvailability != null)
                Wrap(
                  spacing: 8,
                  children: [
                    for (final slot in _firstAvailability!.slots.where((s) => s.available))
                      ChoiceChip(
                        key: Key('visit_slot_${slot.startsAt.toUtc().toIso8601String()}'),
                        label: Text('${riyadhClock(slot.startsAt)}–${riyadhClock(slot.endsAt)}'),
                        selected: _firstSlot?.startsAt == slot.startsAt,
                        onSelected: _recovering
                            ? null
                            : (_) => setState(() {
                                  _firstSlot = slot;
                                  _blockReason = null;
                                  _idempotencyKey = newIdempotencyKey();
                                }),
                      ),
                  ],
                ),
              if (_firstSlot != null && secondEnd != null) ...[
                const SizedBox(height: 12),
                Text('ملخص قبل الإرسال (توقيت الرياض)', style: AppTypography.titleSmall),
                Text(
                  '١) ${_a.nameAr}: ${riyadhClock(_firstSlot!.startsAt)}–${riyadhClock(_firstSlot!.endsAt)} · '
                  '${CatalogPrice.text(known: _a.priceKnown, halalas: _a.priceHalalas)}\n'
                  '٢) ${_b.nameAr}: ${riyadhClock(_firstSlot!.endsAt)}–${riyadhClock(secondEnd)} · '
                  '${CatalogPrice.text(known: _b.priceKnown, halalas: _b.priceHalalas)}\n'
                  'الفرع: $_branchLabel\n'
                  'الحالة بعد الإرسال: طلب بانتظار رد المركز',
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
                onPressed: _submitting || _recovering || _sharedBranchId == null ? null : _submit,
                child: Text(_submitting || _recovering ? 'جارٍ الإرسال' : 'إرسال طلب الزيارة المتتابعة'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
