import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Account-scoped pending consecutive-visit attempt (recover after lost response).
/// Never log contact fields — only persist them locally for the same-key retry body.
class PendingVisitAttempt {
  const PendingVisitAttempt({
    required this.userId,
    required this.idempotencyKey,
    required this.fingerprint,
    required this.branchId,
    required this.items,
    required this.contactName,
    required this.contactPhone,
    this.notes,
    required this.savedAtMs,
  });

  final String userId;
  final String idempotencyKey;
  /// Stable hash of branch + item times/ids (no PII).
  final String fingerprint;
  final String branchId;
  final List<Map<String, dynamic>> items;
  final String contactName;
  final String contactPhone;
  final String? notes;
  final int savedAtMs;

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'idempotencyKey': idempotencyKey,
        'fingerprint': fingerprint,
        'branchId': branchId,
        'items': items,
        'contactName': contactName,
        'contactPhone': contactPhone,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        'savedAtMs': savedAtMs,
      };

  factory PendingVisitAttempt.fromJson(Map<String, dynamic> json) => PendingVisitAttempt(
        userId: json['userId'] as String? ?? '',
        idempotencyKey: json['idempotencyKey'] as String? ?? '',
        fingerprint: json['fingerprint'] as String? ?? '',
        branchId: json['branchId'] as String? ?? '',
        items: (json['items'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(),
        contactName: json['contactName'] as String? ?? '',
        contactPhone: json['contactPhone'] as String? ?? '',
        notes: json['notes'] as String?,
        savedAtMs: json['savedAtMs'] as int? ?? 0,
      );
}

class PendingVisitAttemptStore {
  PendingVisitAttemptStore({SharedPreferences? prefs}) : _prefs = prefs;

  SharedPreferences? _prefs;

  static String _key(String userId) => 'commerce.visit.pending.v1.$userId';

  Future<SharedPreferences> _ensure() async => _prefs ??= await SharedPreferences.getInstance();

  Future<void> save(PendingVisitAttempt attempt) async {
    if (attempt.userId.isEmpty || attempt.idempotencyKey.isEmpty) return;
    final prefs = await _ensure();
    await prefs.setString(_key(attempt.userId), jsonEncode(attempt.toJson()));
  }

  Future<PendingVisitAttempt?> load(String userId) async {
    if (userId.isEmpty) return null;
    final prefs = await _ensure();
    final raw = prefs.getString(_key(userId));
    if (raw == null || raw.isEmpty) return null;
    try {
      final parsed = PendingVisitAttempt.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
      if (parsed.userId != userId) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  Future<void> clear(String userId) async {
    if (userId.isEmpty) return;
    final prefs = await _ensure();
    await prefs.remove(_key(userId));
  }
}

/// Fingerprint for the visit attempt (no contact PII) — must match server request shape loosely.
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
