import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Lifecycle of one consecutive-visit attempt (customer-visible).
enum VisitAttemptPhase {
  /// Form open; no server write yet.
  fresh,
  /// Request in flight.
  submitting,
  /// Server may have written; response lost / verification failed.
  outcomeUnknown,
  /// Visit accepted (requested) — show receipt.
  accepted,
  /// Explicit final rejection — do not auto-resend on reopen.
  rejectedFinal,
}

/// Public index (no contact PII). Contact lives only in [VisitAttemptSecrets].
class PendingVisitAttempt {
  const PendingVisitAttempt({
    required this.userId,
    required this.idempotencyKey,
    required this.fingerprint,
    required this.branchId,
    required this.branchLabel,
    required this.items,
    required this.serviceNamesAr,
    required this.phase,
    required this.savedAtMs,
    this.rejectionCode,
    this.visitId,
    this.publicNumber,
  });

  final String userId;
  final String idempotencyKey;
  final String fingerprint;
  final String branchId;
  final String branchLabel;
  final List<Map<String, dynamic>> items;
  final List<String> serviceNamesAr;
  final VisitAttemptPhase phase;
  final int savedAtMs;
  final String? rejectionCode;
  final String? visitId;
  final String? publicNumber;

  List<String> get serviceIds =>
      items.map((e) => e['serviceId'] as String?).whereType<String>().toList();

  Map<String, dynamic> toIndexJson() => {
        'userId': userId,
        'idempotencyKey': idempotencyKey,
        'fingerprint': fingerprint,
        'branchId': branchId,
        'branchLabel': branchLabel,
        'items': items,
        'serviceNamesAr': serviceNamesAr,
        'phase': phase.name,
        'savedAtMs': savedAtMs,
        if (rejectionCode != null) 'rejectionCode': rejectionCode,
        if (visitId != null) 'visitId': visitId,
        if (publicNumber != null) 'publicNumber': publicNumber,
      };

  factory PendingVisitAttempt.fromIndexJson(Map<String, dynamic> json) {
    final phaseName = json['phase'] as String? ?? VisitAttemptPhase.outcomeUnknown.name;
    final phase = VisitAttemptPhase.values.firstWhere(
      (p) => p.name == phaseName,
      orElse: () => VisitAttemptPhase.outcomeUnknown,
    );
    return PendingVisitAttempt(
      userId: json['userId'] as String? ?? '',
      idempotencyKey: json['idempotencyKey'] as String? ?? '',
      fingerprint: json['fingerprint'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      branchLabel: json['branchLabel'] as String? ?? '',
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
      serviceNamesAr: (json['serviceNamesAr'] as List? ?? const []).whereType<String>().toList(),
      phase: phase,
      savedAtMs: json['savedAtMs'] as int? ?? 0,
      rejectionCode: json['rejectionCode'] as String?,
      visitId: json['visitId'] as String?,
      publicNumber: json['publicNumber'] as String?,
    );
  }

  PendingVisitAttempt copyWith({
    VisitAttemptPhase? phase,
    String? rejectionCode,
    String? visitId,
    String? publicNumber,
  }) =>
      PendingVisitAttempt(
        userId: userId,
        idempotencyKey: idempotencyKey,
        fingerprint: fingerprint,
        branchId: branchId,
        branchLabel: branchLabel,
        items: items,
        serviceNamesAr: serviceNamesAr,
        phase: phase ?? this.phase,
        savedAtMs: savedAtMs,
        rejectionCode: rejectionCode ?? this.rejectionCode,
        visitId: visitId ?? this.visitId,
        publicNumber: publicNumber ?? this.publicNumber,
      );
}

class VisitAttemptContact {
  const VisitAttemptContact({
    required this.contactName,
    required this.contactPhone,
    this.notes,
  });

  final String contactName;
  final String contactPhone;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'contactName': contactName,
        'contactPhone': contactPhone,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };

  factory VisitAttemptContact.fromJson(Map<String, dynamic> json) => VisitAttemptContact(
        contactName: json['contactName'] as String? ?? '',
        contactPhone: json['contactPhone'] as String? ?? '',
        notes: json['notes'] as String?,
      );
}

/// Protected contact vault — production uses Keychain/Keystore via flutter_secure_storage.
abstract class VisitAttemptSecrets {
  Future<void> write(String userId, String idempotencyKey, VisitAttemptContact contact);
  Future<VisitAttemptContact?> read(String userId, String idempotencyKey);
  Future<void> delete(String userId, String idempotencyKey);
}

class SecureVisitAttemptSecrets implements VisitAttemptSecrets {
  SecureVisitAttemptSecrets({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  final MemoryVisitAttemptSecrets _fallback = MemoryVisitAttemptSecrets();
  bool _useFallback = false;

  static String _secretKey(String userId, String attemptKey) =>
      'commerce.visit.contact.v2.$userId.$attemptKey';

  Future<void> _writeSecure(String userId, String idempotencyKey, VisitAttemptContact contact) async {
    await _storage.write(key: _secretKey(userId, idempotencyKey), value: jsonEncode(contact.toJson()));
  }

  Future<VisitAttemptContact?> _readSecure(String userId, String idempotencyKey) async {
    final raw = await _storage.read(key: _secretKey(userId, idempotencyKey));
    if (raw == null || raw.isEmpty) return null;
    try {
      return VisitAttemptContact.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (_) {
      return null;
    }
  }

  Future<void> _deleteSecure(String userId, String idempotencyKey) async {
    await _storage.delete(key: _secretKey(userId, idempotencyKey));
  }

  @override
  Future<void> write(String userId, String idempotencyKey, VisitAttemptContact contact) async {
    if (_useFallback) {
      await _fallback.write(userId, idempotencyKey, contact);
      return;
    }
    try {
      await _writeSecure(userId, idempotencyKey, contact);
    } catch (_) {
      _useFallback = true;
      await _fallback.write(userId, idempotencyKey, contact);
    }
  }

  @override
  Future<VisitAttemptContact?> read(String userId, String idempotencyKey) async {
    if (_useFallback) return _fallback.read(userId, idempotencyKey);
    try {
      return await _readSecure(userId, idempotencyKey);
    } catch (_) {
      _useFallback = true;
      return _fallback.read(userId, idempotencyKey);
    }
  }

  @override
  Future<void> delete(String userId, String idempotencyKey) async {
    if (_useFallback) {
      await _fallback.delete(userId, idempotencyKey);
      return;
    }
    try {
      await _deleteSecure(userId, idempotencyKey);
    } catch (_) {
      _useFallback = true;
      await _fallback.delete(userId, idempotencyKey);
    }
  }
}

/// In-memory secrets for widget tests (no platform channel).
class MemoryVisitAttemptSecrets implements VisitAttemptSecrets {
  final _map = <String, String>{};

  String _k(String userId, String key) => '$userId|$key';

  @override
  Future<void> write(String userId, String idempotencyKey, VisitAttemptContact contact) async {
    _map[_k(userId, idempotencyKey)] = jsonEncode(contact.toJson());
  }

  @override
  Future<VisitAttemptContact?> read(String userId, String idempotencyKey) async {
    final raw = _map[_k(userId, idempotencyKey)];
    if (raw == null) return null;
    return VisitAttemptContact.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
  }

  @override
  Future<void> delete(String userId, String idempotencyKey) async {
    _map.remove(_k(userId, idempotencyKey));
  }
}

/// Multi-attempt index per account (SharedPreferences) + contact secrets.
class PendingVisitAttemptStore {
  PendingVisitAttemptStore({
    SharedPreferences? prefs,
    VisitAttemptSecrets? secrets,
  })  : _prefs = prefs,
        _secrets = secrets ?? SecureVisitAttemptSecrets();

  SharedPreferences? _prefs;
  final VisitAttemptSecrets _secrets;

  static String _indexKey(String userId) => 'commerce.visit.pending.v2.$userId';

  Future<SharedPreferences> _ensure() async => _prefs ??= await SharedPreferences.getInstance();

  Future<List<PendingVisitAttempt>> list(String userId) async {
    if (userId.isEmpty) return const [];
    final prefs = await _ensure();
    final raw = prefs.getString(_indexKey(userId));
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw);
      if (list is! List) return const [];
      final out = <PendingVisitAttempt>[];
      for (final row in list) {
        if (row is! Map) continue;
        final a = PendingVisitAttempt.fromIndexJson(Map<String, dynamic>.from(row));
        if (a.userId == userId) out.add(a);
      }
      return out;
    } catch (_) {
      return const [];
    }
  }

  Future<PendingVisitAttempt?> get(String userId, String idempotencyKey) async {
    final all = await list(userId);
    for (final a in all) {
      if (a.idempotencyKey == idempotencyKey) return a;
    }
    return null;
  }

  /// Open / unknown attempts that still need customer attention.
  Future<List<PendingVisitAttempt>> actionable(String userId) async {
    final all = await list(userId);
    return all
        .where((a) => a.phase == VisitAttemptPhase.outcomeUnknown || a.phase == VisitAttemptPhase.submitting)
        .toList();
  }

  Future<void> upsert(PendingVisitAttempt attempt, {VisitAttemptContact? contact}) async {
    if (attempt.userId.isEmpty || attempt.idempotencyKey.isEmpty) return;
    final all = await list(attempt.userId);
    final next = [
      for (final a in all)
        if (a.idempotencyKey != attempt.idempotencyKey) a,
      attempt,
    ];
    final prefs = await _ensure();
    await prefs.setString(_indexKey(attempt.userId), jsonEncode([for (final a in next) a.toIndexJson()]));
    if (contact != null) {
      await _secrets.write(attempt.userId, attempt.idempotencyKey, contact);
    }
  }

  Future<VisitAttemptContact?> readContact(String userId, String idempotencyKey) =>
      _secrets.read(userId, idempotencyKey);

  /// Remove index row + secret for this account+key only (never other attempts).
  Future<void> remove(String userId, String idempotencyKey) async {
    if (userId.isEmpty || idempotencyKey.isEmpty) return;
    final all = await list(userId);
    final next = [for (final a in all) if (a.idempotencyKey != idempotencyKey) a];
    final prefs = await _ensure();
    if (next.isEmpty) {
      await prefs.remove(_indexKey(userId));
    } else {
      await prefs.setString(_indexKey(userId), jsonEncode([for (final a in next) a.toIndexJson()]));
    }
    await _secrets.delete(userId, idempotencyKey);
  }
}

String pendingVisitFingerprint({
  required String branchId,
  required List<Map<String, dynamic>> items,
}) {
  final normalized = items
      .map(
        (it) => {
          'serviceId': it['serviceId'],
          'startsAt': it['startsAt'],
          'resourceId': it['resourceId'] ?? '',
        },
      )
      .toList();
  return jsonEncode({'branchId': branchId, 'items': normalized});
}

/// Final server rejections — do not auto-resend on reopen even if the service becomes bookable later.
bool isFinalVisitRejection(String code) {
  const finals = {
    'BOOKING_NOT_ENABLED',
    'ACTIVITY_NOT_APPROVED',
    'PLACE_NOT_ALLOWED',
    'PLACE_REQUIRED',
    'BRANCH_NOT_OWNED',
    'BRANCH_INACTIVE',
    'BRANCH_NOT_FOR_SERVICE',
    'BRANCH_REQUIRED',
    'SERVICE_NOT_FOUND',
    'SERVICE_NOT_BOOKABLE',
    'PAY_MODE_UNSUPPORTED',
    'VISIT_PARTNER_MISMATCH',
    'VISIT_ITEMS_EXACTLY_TWO',
    'IDEMPOTENCY_CONFLICT',
  };
  return finals.contains(code);
}
