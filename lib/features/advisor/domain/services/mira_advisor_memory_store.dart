import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Cross-session preferences scoped by Firebase uid.
/// Long-term memory is opt-in per account (default off).
class MiraAdvisorMemoryStore {
  MiraAdvisorMemoryStore._();

  static const _kAccountScope = 'mira_advisor_memory_uid';

  static String? _uid;
  static String? _sessionId;

  static String _pref(String leaf) {
    final uid = _uid;
    if (uid == null || uid.isEmpty) return 'mira_advisor_anon_$leaf';
    return 'mira_advisor_${uid}_$leaf';
  }

  /// Opt-in only — never default to remembering without a clear choice.
  static Future<bool> isEnabled() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_pref('memory_enabled')) ?? false;
  }

  /// True when the client has explicitly chosen on or off (key present).
  static Future<bool> hasExplicitConsentChoice() async {
    final p = await SharedPreferences.getInstance();
    return p.containsKey(_pref('memory_enabled'));
  }

  static Future<void> setEnabled(bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_pref('memory_enabled'), value);
  }

  /// Must run before create/resume so subsequent reads use the right account.
  static Future<void> bindAccount(String? uid) async {
    final p = await SharedPreferences.getInstance();
    _uid = (uid != null && uid.isNotEmpty) ? uid : null;
    if (_uid == null) {
      await p.remove(_kAccountScope);
      _sessionId = null;
      return;
    }
    await p.setString(_kAccountScope, _uid!);
  }

  /// Scope offer memory to the active consultation session under this account.
  static Future<void> bindSession(String? sessionId) async {
    _sessionId = (sessionId != null && sessionId.isNotEmpty) ? sessionId : null;
  }

  static Future<void> clearPreferences() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_pref('budget_habit_sar'));
    await p.remove(_pref('city'));
    await p.remove(_pref('notes_ar'));
    await p.remove(_offersKey());
  }

  static Future<void> forgetAll() async {
    await clearPreferences();
    final p = await SharedPreferences.getInstance();
    await p.setBool(_pref('memory_enabled'), false);
  }

  static Future<void> saveHabitBudgetSar(int? sar) async {
    if (!await isEnabled()) return;
    final p = await SharedPreferences.getInstance();
    final key = _pref('budget_habit_sar');
    if (sar == null) {
      await p.remove(key);
    } else {
      await p.setInt(key, sar);
    }
  }

  static Future<int?> habitBudgetSar() async {
    if (!await isEnabled()) return null;
    final p = await SharedPreferences.getInstance();
    return p.getInt(_pref('budget_habit_sar'));
  }

  static Future<void> saveCity(String? city) async {
    final p = await SharedPreferences.getInstance();
    final key = _pref('city');
    final v = city?.trim() ?? '';
    // Allow clearing even when memory was just disabled mid-turn.
    if (v.isEmpty) {
      await p.remove(key);
      return;
    }
    if (!await isEnabled()) return;
    await p.setString(key, v);
  }

  static Future<String?> city() async {
    if (!await isEnabled()) return null;
    final p = await SharedPreferences.getInstance();
    return p.getString(_pref('city'));
  }

  static Future<void> saveNotesAr(String? notes) async {
    if (!await isEnabled()) return;
    final p = await SharedPreferences.getInstance();
    final key = _pref('notes_ar');
    final v = notes?.trim() ?? '';
    if (v.isEmpty) {
      await p.remove(key);
    } else {
      await p.setString(key, v);
    }
  }

  static Future<String?> notesAr() async {
    if (!await isEnabled()) return null;
    final p = await SharedPreferences.getInstance();
    return p.getString(_pref('notes_ar'));
  }

  static String _offersKey() {
    final sid = _sessionId;
    if (sid == null || sid.isEmpty) return _pref('last_offers');
    return _pref('offers_$sid');
  }

  static String _awaitingLinkKey() {
    final sid = _sessionId;
    if (sid == null || sid.isEmpty) return _pref('awaiting_link_ordinal');
    return _pref('awaiting_link_$sid');
  }

  /// After a link clarify, bare «الثاني» may open — cleared on open or new offers.
  static Future<void> setAwaitingLinkOrdinal(bool value) async {
    final p = await SharedPreferences.getInstance();
    final key = _awaitingLinkKey();
    if (value) {
      await p.setBool(key, true);
    } else {
      await p.remove(key);
    }
  }

  static Future<bool> isAwaitingLinkOrdinal() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_awaitingLinkKey()) ?? false;
  }

  static String _pendingPrefsListKey() => _pref('pending_prefs_ops_json');
  static String _pendingTranscriptKey() => _pref('pending_transcript_json');

  /// Stable fingerprint: account + session + op + content.
  /// «تذكّري الرياض» and «انسي مدينتي» are different commands → different fingerprints.
  static String preferenceOpFingerprint({
    required String op,
    required String sessionId,
    String? accountUid,
    String? goalAr,
  }) {
    final uid = accountUid ?? _uid ?? '';
    final content = op == 'clear' ? '' : (goalAr ?? '');
    return '$uid|$sessionId|$op|$content';
  }

  /// Queue preference sync ops per account — multiple sessions/commands coexist.
  /// Replacing is by fingerprint (same command retry), never by session alone.
  static Future<void> queuePendingPreferenceOp({
    required String op,
    required String sessionId,
    required String opId,
    String? accountUid,
    String? goalAr,
  }) async {
    assert(op == 'set' || op == 'clear');
    final p = await SharedPreferences.getInstance();
    final uid = accountUid ?? _uid ?? '';
    final fingerprint = preferenceOpFingerprint(
      op: op,
      sessionId: sessionId,
      accountUid: uid,
      goalAr: goalAr,
    );
    final list = await pendingPreferenceOps();
    list.removeWhere((e) => e['opId'] == opId);
    list.removeWhere((e) => e['fingerprint'] == fingerprint);
    list.add({
      'op': op,
      'sessionId': sessionId,
      'accountUid': uid,
      'opId': opId,
      'fingerprint': fingerprint,
      if (op == 'set') 'goalAr': goalAr ?? '',
      'queuedAt': DateTime.now().toUtc().toIso8601String(),
    });
    await p.setString(_pendingPrefsListKey(), jsonEncode(list));
    // Drop legacy single-slot key if present.
    await p.remove(_pref('pending_prefs_op_json'));
  }

  @Deprecated('Use queuePendingPreferenceOp')
  static Future<void> queuePendingPreferenceGoal(String? goalAr) async {
    final sid = _sessionId ?? '';
    if (sid.isEmpty) return;
    final v = goalAr?.trim() ?? '';
    if (v.isEmpty) {
      await queuePendingPreferenceOp(
        op: 'clear',
        sessionId: sid,
        opId: 'legacy-clear-${DateTime.now().microsecondsSinceEpoch}',
        accountUid: _uid,
      );
    } else {
      await queuePendingPreferenceOp(
        op: 'set',
        sessionId: sid,
        opId: 'legacy-set-${DateTime.now().microsecondsSinceEpoch}',
        accountUid: _uid,
        goalAr: v,
      );
    }
  }

  static Future<List<Map<String, dynamic>>> pendingPreferenceOps() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_pendingPrefsListKey());
    final list = <Map<String, dynamic>>[];
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final e in decoded) {
            if (e is Map) list.add(Map<String, dynamic>.from(e));
          }
        }
      } catch (_) {}
    }
    // Migrate legacy single-op key.
    final legacy = p.getString(_pref('pending_prefs_op_json'));
    if (legacy != null && legacy.isNotEmpty) {
      try {
        final decoded = jsonDecode(legacy);
        if (decoded is Map) {
          list.add(Map<String, dynamic>.from(decoded));
        } else if (legacy.trim().isNotEmpty && !legacy.trim().startsWith('{')) {
          list.add({
            'op': 'set',
            'sessionId': _sessionId ?? '',
            'accountUid': _uid ?? '',
            'opId': 'migrated-plain',
            'goalAr': legacy,
          });
        }
      } catch (_) {
        if (legacy.trim().isNotEmpty && !legacy.trim().startsWith('{')) {
          list.add({
            'op': 'set',
            'sessionId': _sessionId ?? '',
            'accountUid': _uid ?? '',
            'opId': 'migrated-plain',
            'goalAr': legacy,
          });
        }
      }
      await p.remove(_pref('pending_prefs_op_json'));
      await p.setString(_pendingPrefsListKey(), jsonEncode(list));
    }
    return list;
  }

  /// First pending op (compatibility). Prefer [pendingPreferenceOps].
  static Future<Map<String, dynamic>?> pendingPreferenceOp() async {
    final list = await pendingPreferenceOps();
    return list.isEmpty ? null : list.first;
  }

  static Future<String?> pendingPreferenceGoal() async {
    final op = await pendingPreferenceOp();
    if (op == null) return null;
    if (op['op'] == 'clear') return '';
    return op['goalAr'] as String? ?? '';
  }

  /// Remove only the op the server acknowledged — never clear the whole queue blindly.
  static Future<void> acknowledgePendingPreferenceOp(String opId) async {
    final p = await SharedPreferences.getInstance();
    final list = await pendingPreferenceOps();
    list.removeWhere((e) => e['opId'] == opId);
    if (list.isEmpty) {
      await p.remove(_pendingPrefsListKey());
    } else {
      await p.setString(_pendingPrefsListKey(), jsonEncode(list));
    }
  }

  static Future<void> clearPendingPreferenceOp() async {
    final list = await pendingPreferenceOps();
    if (list.isEmpty) return;
    final first = list.first['opId'] as String?;
    if (first != null) await acknowledgePendingPreferenceOp(first);
  }

  static Future<void> clearPendingPreferenceGoal() => clearPendingPreferenceOp();

  static Future<void> savePendingPreferenceOps(List<Map<String, dynamic>> rows) async {
    final p = await SharedPreferences.getInstance();
    if (rows.isEmpty) {
      await p.remove(_pendingPrefsListKey());
    } else {
      await p.setString(_pendingPrefsListKey(), jsonEncode(rows));
    }
  }

  static Future<void> enqueuePendingTranscript({
    required String sessionId,
    required String userContentAr,
    required String assistantContentAr,
    required String clientMessageId,
  }) async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_pendingTranscriptKey());
    final list = <Map<String, dynamic>>[];
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final e in decoded) {
            if (e is Map) list.add(Map<String, dynamic>.from(e));
          }
        }
      } catch (_) {}
    }
    list.removeWhere((e) => e['clientMessageId'] == clientMessageId);
    list.add({
      'sessionId': sessionId,
      'userContentAr': userContentAr,
      'assistantContentAr': assistantContentAr,
      'clientMessageId': clientMessageId,
    });
    await p.setString(_pendingTranscriptKey(), jsonEncode(list));
  }

  static Future<List<Map<String, dynamic>>> pendingTranscripts() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_pendingTranscriptKey());
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return [
        for (final e in decoded)
          if (e is Map) Map<String, dynamic>.from(e),
      ];
    } catch (_) {
      return const [];
    }
  }

  static Future<void> savePendingTranscripts(List<Map<String, dynamic>> rows) async {
    final p = await SharedPreferences.getInstance();
    if (rows.isEmpty) {
      await p.remove(_pendingTranscriptKey());
    } else {
      await p.setString(_pendingTranscriptKey(), jsonEncode(rows));
    }
  }

  static Future<void> rememberTurnOffers(
    List<({String id, String kind, String titleAr, String? liveStatus})> offers,
  ) async {
    final p = await SharedPreferences.getInstance();
    final key = _offersKey();
    if (offers.isEmpty) {
      await p.remove(key);
      await setAwaitingLinkOrdinal(false);
      return;
    }
    await p.setString(
      key,
      jsonEncode([
        for (final o in offers)
          {
            'id': o.id,
            'kind': o.kind,
            'titleAr': o.titleAr,
            if (o.liveStatus != null) 'liveStatus': o.liveStatus,
          },
      ]),
    );
    await setAwaitingLinkOrdinal(false);
  }

  static Future<List<({String id, String kind, String titleAr, String? liveStatus})>>
      lastTurnOffers() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_offersKey());
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw);
      if (list is! List) return const [];
      return [
        for (final e in list)
          if (e is Map && (e['id'] as String?)?.isNotEmpty == true)
            (
              id: e['id'] as String,
              kind: (e['kind'] as String?) ?? 'product',
              titleAr: (e['titleAr'] as String?) ?? '',
              liveStatus: e['liveStatus'] as String?,
            ),
      ];
    } catch (_) {
      return const [];
    }
  }

  static Future<String?> preferenceBriefAr() async {
    if (!await isEnabled()) return null;
    final budget = await habitBudgetSar();
    final cityName = await city();
    final notes = await notesAr();
    final parts = <String>[
      if (budget != null) 'عادة تحبّين خيارات تحت $budget ريال',
      if (cityName != null && cityName.isNotEmpty) 'المدينة: $cityName',
      if (notes != null && notes.isNotEmpty) notes,
    ];
    if (parts.isEmpty) return null;
    return 'تفضيلات محفوظة بموافقة العميلة: ${parts.join(' · ')}';
  }

  /// True when [serverStatedGoalAr] still cites a city that local memory no longer has.
  static bool serverGoalStillCitesCity(String? serverStatedGoalAr, String? localCity) {
    final goal = serverStatedGoalAr ?? '';
    if (!goal.contains('المدينة:')) return false;
    if (localCity == null || localCity.isEmpty) return true;
    return !goal.contains('المدينة: $localCity');
  }

  /// Habitual prefs only — never occasion location/budget.
  static Future<void> absorbExplicitPrefsFromMessage(String message) async {
    final text = message.trim();

    if (RegExp(
      r'تذكري تفضيلاتي|فعّلي التخصيص|فعلي التخصيص|احفظي تفضيلاتي|وافقت على التخصيص',
    ).hasMatch(text)) {
      await setEnabled(true);
    }

    if (RegExp(
      r'انسَ?ي?\s*(تفضيلي|ميزانيتي|مدينتي)|لا تتذكرين|أوقفي التخصيص|انسِ?ي\s*مدينتي',
    ).hasMatch(text)) {
      if (RegExp(r'مدينتي').hasMatch(text) &&
          !RegExp(r'تفضيلي|ميزانيتي|التخصيص|لا تتذكرين').hasMatch(text)) {
        await saveCity(null);
        return;
      }
      await forgetAll();
      return;
    }

    if (!await isEnabled()) return;

    final correction = RegExp(
      r'مدينتي\s+(الرياض|جدة|جده|الدمام|مكة|المدينة)\s*(?:مو|مش|وليس)\s+',
    ).firstMatch(text);
    if (correction != null) {
      await saveCity(correction.group(1));
      return;
    }

    final habit = RegExp(
      r'(عادة|دائم(?:اً|ا)|عموم(?:اً|ا)).{0,24}?(?:تحت|أقل من|باقل من)\s*(\d{2,5})',
    ).firstMatch(text);
    if (habit != null) {
      await saveHabitBudgetSar(int.tryParse(habit.group(2)!));
    }

    if (RegExp(
      r'(مناسبة|حفل|تخرج|زفاف|موعد|حجز).{0,20}في\s+(الرياض|جدة|جده|الدمام|مكة|المدينة)',
    ).hasMatch(text)) {
      return;
    }

    final cityMatch = RegExp(
      r'(?:مدينتي|أسكن في|أعيش في|ساكنة في|ساكنه في)\s+(الرياض|جدة|جده|الدمام|مكة|المدينة)',
    ).firstMatch(text);
    if (cityMatch != null) {
      await saveCity(cityMatch.group(1));
    }
  }
}
