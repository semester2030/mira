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
    this.resumeIdempotencyKey,
  });

  /// Exactly two services the customer selected for this visit (may be stubs when resuming).
  final List<CatalogService> services;
  final CommerceClient? client;
  final PendingVisitAttemptStore? pendingStore;

  /// When opening from «حجوزاتي», recover this attempt by account+key before availability.
  final String? resumeIdempotencyKey;

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
  bool _outcomeUnknown = false;
  bool _rejectedFinal = false;

  String? _idempotencyKey;
  String? _completedVisitId;
  String? _completedPublicNumber;
  List<String> _acceptedServiceIds = const [];
  List<CommerceBooking> _acceptedBookings = const [];
  PendingVisitAttempt? _activeAttempt;

  CatalogService get _a => widget.services.first;
  CatalogService get _b => widget.services[1];

  bool get _lockedOnPendingKey =>
      _outcomeUnknown || _recovering || (_activeAttempt?.phase == VisitAttemptPhase.outcomeUnknown);

  String? get _sharedBranchId {
    final a = (_a.branchId ?? '').trim();
    final b = (_b.branchId ?? '').trim();
    if (a.isNotEmpty && b.isNotEmpty) return a == b ? a : null;
    if (a.isNotEmpty && b.isEmpty) return a;
    if (b.isNotEmpty && a.isEmpty) return b;
    return _activeAttempt?.branchId;
  }

  String get _branchLabel {
    if (_activeAttempt != null && _activeAttempt!.branchLabel.isNotEmpty) {
      return _activeAttempt!.branchLabel;
    }
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
    final recovered = await _tryRecoverPending();
    if (_completedVisitId != null) return;
    if (recovered && _outcomeUnknown) {
      // Stay on verification UI — do not load availability or start a new attempt.
      return;
    }
    if (_rejectedFinal) return;
    await _loadFirstSlots();
  }

  /// Explicit customer action: keep the rejected attempt as history, start a *new* key/attempt.
  Future<void> _startNewRequestAfterReject() async {
    if (!_rejectedFinal) return;
    setState(() {
      _rejectedFinal = false;
      _outcomeUnknown = false;
      _activeAttempt = null;
      _idempotencyKey = newIdempotencyKey();
      _error = null;
      _blockReason = null;
      _firstSlot = null;
    });
    await _loadFirstSlots();
  }

  /// Returns true when an actionable / terminal pending attempt was found for this screen.
  Future<bool> _tryRecoverPending() async {
    final account = _client.accountKey;
    if (account == null || account.isEmpty) return false;

    PendingVisitAttempt? pending;
    final resumeKey = widget.resumeIdempotencyKey?.trim();
    if (resumeKey != null && resumeKey.isNotEmpty) {
      pending = await _pending.get(account, resumeKey);
    } else {
      // Match this pair only — never steal another attempt's key.
      // Prefer recoverable phases; rejectedFinal is shown only to stop auto-resend (not as a live form).
      final all = await _pending.list(account);
      final screenIds = {_a.id, _b.id};
      PendingVisitAttempt? rejectedMatch;
      for (final a in all) {
        final pendingIds = a.serviceIds.toSet();
        if (pendingIds.length != 2 || pendingIds.difference(screenIds).isNotEmpty) continue;
        if (a.phase == VisitAttemptPhase.outcomeUnknown ||
            a.phase == VisitAttemptPhase.submitting ||
            (a.phase == VisitAttemptPhase.accepted && a.visitId != null)) {
          pending = a;
          break;
        }
        if (a.phase == VisitAttemptPhase.rejectedFinal) {
          rejectedMatch ??= a;
        }
      }
      pending ??= rejectedMatch;
    }
    if (pending == null) return false;
    if (pending.phase == VisitAttemptPhase.accepted && pending.visitId != null) {
      setState(() {
        _activeAttempt = pending;
        _idempotencyKey = pending!.idempotencyKey;
        _completedVisitId = pending.visitId;
        _completedPublicNumber = pending.publicNumber;
      });
      return true;
    }
    if (pending.phase == VisitAttemptPhase.rejectedFinal) {
      // View prior rejection only — never auto-resend. New request requires explicit CTA.
      setState(() {
        _activeAttempt = pending;
        _idempotencyKey = pending!.idempotencyKey;
        _rejectedFinal = true;
        _error = pending.rejectionCode == null
            ? 'رُفض الطلب نهائيًا. اضغطي «بدء طلب جديد» لاختيار موعد بمفتاح جديد.'
            : 'رُفض الطلب (${pending.rejectionCode}). اضغطي «بدء طلب جديد» لاختيار موعد بمفتاح جديد.';
      });
      return true;
    }
    if (pending.phase != VisitAttemptPhase.outcomeUnknown &&
        pending.phase != VisitAttemptPhase.submitting) {
      return false;
    }

    final contact = await _pending.readContact(account, pending.idempotencyKey);
    setState(() {
      _recovering = true;
      _outcomeUnknown = true;
      _activeAttempt = pending;
      _idempotencyKey = pending!.idempotencyKey;
      if (contact != null) {
        _name.text = contact.contactName;
        _phone.text = SaudiPhone.display(contact.contactPhone);
        if (contact.notes != null) _notes.text = contact.notes!;
      }
    });

    await _verifyOrReplay(pending, contact);
    return true;
  }

  Future<void> _verifyOrReplay(PendingVisitAttempt pending, VisitAttemptContact? contact) async {
    final account = _client.accountKey;
    if (account == null) return;
    setState(() {
      _recovering = true;
      _error = null;
    });
    try {
      // Prefer lookup by key — never treat availability as a receipt.
      // getVisitByKey returns null only for VISIT_NOT_FOUND; generic 404 throws (no auto POST).
      final byKey = await _client.getVisitByKey(pending.idempotencyKey);
      if (byKey != null) {
        await _applyVisitResult(byKey.visit, clearPending: true);
        return;
      }

      // VISIT_NOT_FOUND for *this* key only → same-key replay is appropriate when body unchanged.
      final c = contact ?? await _pending.readContact(account, pending.idempotencyKey);
      if (c == null || c.contactName.isEmpty || c.contactPhone.isEmpty) {
        if (mounted) {
          setState(() {
            _outcomeUnknown = true;
            _error = 'لم نتحقق من نتيجة الطلب. بيانات الاتصال المحمية غير متاحة لإعادة الإرسال — اضغطي «تحققي من طلبي» لاحقًا.';
          });
        }
        return;
      }

      await _pending.upsert(
        pending.copyWith(phase: VisitAttemptPhase.submitting),
        contact: c,
      );

      final result = await _client.createConsecutiveVisit(
        idempotencyKey: pending.idempotencyKey,
        branchId: pending.branchId,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        items: pending.items,
        notes: c.notes,
      );
      await _applyVisitResult(result.visit, clearPending: true);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (e) {
      if (!mounted) return;
      if (isFinalVisitRejection(e.code)) {
        // Terminal: drop protected contact; keep index so reopen does not auto-resend.
        await _pending.remove(account, pending.idempotencyKey);
        final terminal = pending.copyWith(phase: VisitAttemptPhase.rejectedFinal, rejectionCode: e.code);
        await _pending.upsert(terminal);
        setState(() {
          _rejectedFinal = true;
          _outcomeUnknown = false;
          _activeAttempt = terminal;
          _error = e.messageAr;
        });
        return;
      }
      // Network / 5xx / ambiguous — stay outcomeUnknown; do not invent SLOT_FULL from self.
      await _pending.upsert(pending.copyWith(phase: VisitAttemptPhase.outcomeUnknown));
      setState(() {
        _outcomeUnknown = true;
        _error = 'لم نتحقق من نتيجة الطلب (${e.messageAr}). اضغطي «تحققي من طلبي» دون إنشاء محاولة جديدة.';
      });
    } catch (e) {
      await _pending.upsert(pending.copyWith(phase: VisitAttemptPhase.outcomeUnknown));
      if (mounted) {
        setState(() {
          _outcomeUnknown = true;
          _error = 'لم نتحقق من نتيجة الطلب. ${commerceErrorText(e)}';
        });
      }
    } finally {
      if (mounted) setState(() => _recovering = false);
    }
  }

  Future<void> _applyVisitResult(CommerceVisit visit, {required bool clearPending}) async {
    _completedVisitId = visit.id;
    _completedPublicNumber = visit.publicNumber;
    _acceptedServiceIds = visit.bookings.map((b) => b.serviceId).toList();
    _acceptedBookings = visit.bookings;
    _outcomeUnknown = false;
    _rejectedFinal = false;
    if (clearPending) {
      final account = _client.accountKey;
      final key = _idempotencyKey ?? _activeAttempt?.idempotencyKey;
      if (account != null && key != null) await _pending.remove(account, key);
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

  Future<void> _onVerifyPressed() async {
    final attempt = _activeAttempt;
    if (attempt == null) return;
    final account = _client.accountKey;
    if (account == null) return;
    final contact = await _pending.readContact(account, attempt.idempotencyKey);
    await _verifyOrReplay(attempt, contact);
  }

  Future<void> _submit() async {
    if (_submitting || _recovering) return;
    if (_completedVisitId != null) {
      Navigator.of(context).pop(<String>{..._acceptedServiceIds});
      return;
    }
    // Lost response / unknown outcome: verify by key before any availability read or new key.
    if (_outcomeUnknown && _activeAttempt != null) {
      await _onVerifyPressed();
      return;
    }
    if (_rejectedFinal) {
      setState(() => _error = 'الطلب السابق رُفض نهائيًا. اضغطي «بدء طلب جديد» ثم أرسلي طلبًا بمفتاح جديد.');
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
      final contact = VisitAttemptContact(
        contactName: _name.text.trim(),
        contactPhone: phone,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );
      final attempt = PendingVisitAttempt(
        userId: account,
        idempotencyKey: _idempotencyKey!,
        fingerprint: fp,
        branchId: branchId,
        branchLabel: _branchLabel,
        items: items,
        serviceNamesAr: [_a.nameAr, _b.nameAr],
        phase: VisitAttemptPhase.submitting,
        savedAtMs: DateTime.now().millisecondsSinceEpoch,
      );
      // Persist *before* the first send so a lost success can be recovered by key.
      await _pending.upsert(attempt, contact: contact);
      _activeAttempt = attempt;

      final result = await _client.createConsecutiveVisit(
        idempotencyKey: _idempotencyKey!,
        branchId: branchId,
        contactName: contact.contactName,
        contactPhone: contact.contactPhone,
        notes: contact.notes,
        items: items,
      );
      await _applyVisitResult(result.visit, clearPending: true);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (e) {
      if (!mounted) return;
      final account = _client.accountKey;
      final key = _idempotencyKey;
      if (account != null && key != null && _activeAttempt != null) {
        if (isFinalVisitRejection(e.code)) {
          await _pending.remove(account, key);
          await _pending.upsert(
            _activeAttempt!.copyWith(phase: VisitAttemptPhase.rejectedFinal, rejectionCode: e.code),
          );
          setState(() {
            _rejectedFinal = true;
            _error = e.messageAr;
          });
        } else if (e.code == CommerceApiException.network || (e.status != null && e.status! >= 500) || e.status == 0) {
          await _pending.upsert(_activeAttempt!.copyWith(phase: VisitAttemptPhase.outcomeUnknown));
          setState(() {
            _outcomeUnknown = true;
            _error = 'لم نتحقق من نتيجة الطلب. اضغطي «تحققي من طلبي».';
          });
        } else if (isFinalVisitRejection(e.code) == false) {
          // Soft/transient conflict (e.g. SLOT_FULL for a different customer) — keep attempt if we may have written.
          // For clear client validation before write, drop submitting mark.
          if (e.status == 409 || e.status == 422) {
            // Ambiguous whether server wrote — keep outcomeUnknown only for network; 422 before write can clear.
            if (e.code == 'BOOKING_SLOT_FULL' || e.code == 'BOOKING_USER_OVERLAP') {
              await _pending.remove(account, key);
              setState(() => _error = e.messageAr);
            } else if (isFinalVisitRejection(e.code)) {
              // unreachable
            } else {
              await _pending.remove(account, key);
              setState(() => _error = e.messageAr);
            }
          } else {
            await _pending.upsert(_activeAttempt!.copyWith(phase: VisitAttemptPhase.outcomeUnknown));
            setState(() {
              _outcomeUnknown = true;
              _error = 'لم نتحقق من نتيجة الطلب (${e.messageAr}).';
            });
          }
        }
      } else {
        setState(() => _error = e.messageAr);
      }
    } catch (e) {
      final account = _client.accountKey;
      final key = _idempotencyKey;
      if (account != null && key != null && _activeAttempt != null) {
        await _pending.upsert(_activeAttempt!.copyWith(phase: VisitAttemptPhase.outcomeUnknown));
        if (mounted) {
          setState(() {
            _outcomeUnknown = true;
            _error = 'لم نتحقق من نتيجة الطلب. ${commerceErrorText(e)}';
          });
        }
      } else if (mounted) {
        setState(() => _error = commerceErrorText(e));
      }
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

    final titleNames = _activeAttempt?.serviceNamesAr.isNotEmpty == true
        ? '${_activeAttempt!.serviceNamesAr[0]} → ${_activeAttempt!.serviceNamesAr.length > 1 ? _activeAttempt!.serviceNamesAr[1] : _b.nameAr}'
        : '${_a.nameAr} → ${_b.nameAr}';

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
              if (_recovering || _outcomeUnknown)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _recovering
                        ? 'جارٍ استرجاع طلب الزيارة بالمفتاح…'
                        : 'لم نتحقق من نتيجة الطلب — الاسترجاع بالمفتاح قبل أي فحص للتوفر.',
                    key: const Key('pending_outcome_unknown'),
                    style: AppTypography.bodySmall.copyWith(color: Colors.orange.shade800),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (_rejectedFinal) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'رُفض الطلب نهائيًا — لن يُعاد الإرسال تلقائيًا.',
                    key: const Key('pending_rejected_final'),
                    style: AppTypography.bodySmall.copyWith(color: Colors.red.shade700),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  key: const Key('start_new_visit_after_reject'),
                  onPressed: _recovering || _submitting ? null : _startNewRequestAfterReject,
                  child: const Text('بدء طلب جديد'),
                ),
              ],
              if (_completedPublicNumber != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'مرجع الطلب: $_completedPublicNumber — طلب بانتظار رد المركز',
                    style: AppTypography.titleSmall,
                    textAlign: TextAlign.center,
                  ),
                ),
              if (_acceptedBookings.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    [
                      for (final b in _acceptedBookings)
                        '«${b.serviceNameAr}» ${riyadhClock(b.startsAt)}–${riyadhClock(b.endsAt)} · ${b.publicNumber}',
                    ].join('\n'),
                    style: AppTypography.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ),
              const SizedBox(height: 12),
              Text(titleNames, style: AppTypography.titleMedium, textAlign: TextAlign.center),
              Text(_a.partnerNameAr, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
              Text(
                _sharedBranchId == null ? 'لا يوجد فرع مشترك منشور' : 'الفرع: $_branchLabel',
                style: AppTypography.bodyMedium.copyWith(
                  color: _sharedBranchId == null ? Colors.red.shade700 : AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              if (!_outcomeUnknown && !_rejectedFinal) ...[
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
                        onSelected: _lockedOnPendingKey
                            ? null
                            : (_) {
                                setState(() => _dateIndex = i);
                                // Fresh attempt only — never replace an unknown-outcome key.
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
                          onSelected: _lockedOnPendingKey
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
              ],
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
              if (_outcomeUnknown)
                FilledButton(
                  key: const Key('verify_pending_visit'),
                  onPressed: _recovering ? null : _onVerifyPressed,
                  child: Text(_recovering ? 'جارٍ التحقق…' : 'تحققي من طلبي'),
                )
              else
                FilledButton(
                  key: const Key('submit_consecutive_visit'),
                  onPressed: _submitting || _recovering || _sharedBranchId == null || _rejectedFinal
                      ? null
                      : _submit,
                  child: Text(_submitting || _recovering ? 'جارٍ الإرسال' : 'إرسال طلب الزيارة المتتابعة'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
