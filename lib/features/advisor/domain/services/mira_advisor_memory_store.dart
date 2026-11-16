import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Cross-session preferences the customer explicitly allows Mira to remember.
/// Keys are scoped by Firebase uid so account switches never leak prefs.
/// Session transcript stays separate; disabling memory does not disable chat.
class MiraAdvisorMemoryStore {
  MiraAdvisorMemoryStore._();

  static const _kEnabled = 'mira_advisor_memory_enabled';
  static const _kAccountScope = 'mira_advisor_memory_uid';
  static const _kLastOffersJson = 'mira_advisor_last_offers_json';

  static String? _uid;

  static String _pref(String leaf) {
    final uid = _uid;
    if (uid == null || uid.isEmpty) return 'mira_advisor_anon_$leaf';
    return 'mira_advisor_${uid}_$leaf';
  }

  static Future<bool> isEnabled() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_kEnabled) ?? true;
  }

  static Future<void> setEnabled(bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, value);
  }

  /// Bind prefs to the signed-in account. Switching uid clears the previous
  /// account's in-memory pointer and does not read the other account's keys.
  static Future<void> bindAccount(String? uid) async {
    final p = await SharedPreferences.getInstance();
    final previous = p.getString(_kAccountScope);
    _uid = (uid != null && uid.isNotEmpty) ? uid : null;
    if (_uid == null) {
      await p.remove(_kAccountScope);
      return;
    }
    if (previous != null && previous != _uid) {
      // Do not delete other account keys (they stay under their uid prefix).
      // Clear only session-scoped last-offers so a new account never opens them.
      await p.remove(_kLastOffersJson);
    }
    await p.setString(_kAccountScope, _uid!);
  }

  static Future<void> clearPreferences() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_pref('budget_habit_sar'));
    await p.remove(_pref('city'));
    await p.remove(_pref('notes_ar'));
    await p.remove(_kLastOffersJson);
  }

  static Future<void> forgetAll() async {
    await clearPreferences();
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, false);
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
    if (!await isEnabled()) return;
    final p = await SharedPreferences.getInstance();
    final key = _pref('city');
    final v = city?.trim() ?? '';
    if (v.isEmpty) {
      await p.remove(key);
    } else {
      await p.setString(key, v);
    }
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

  /// Occasion budgets must NOT be written here — only habitual prefs.
  /// Persist the full offer list from the latest assistant turn (per session UI).
  static Future<void> rememberTurnOffers(
    List<({String id, String kind, String titleAr})> offers,
  ) async {
    final p = await SharedPreferences.getInstance();
    if (offers.isEmpty) {
      await p.remove(_kLastOffersJson);
      return;
    }
    await p.setString(
      _kLastOffersJson,
      jsonEncode([
        for (final o in offers)
          {'id': o.id, 'kind': o.kind, 'titleAr': o.titleAr},
      ]),
    );
  }

  static Future<List<({String id, String kind, String titleAr})>> lastTurnOffers() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_kLastOffersJson);
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
            ),
      ];
    } catch (_) {
      return const [];
    }
  }

  @Deprecated('Use rememberTurnOffers / lastTurnOffers')
  static Future<void> rememberLastOffer({
    required String id,
    required String kind,
  }) =>
      rememberTurnOffers([(id: id, kind: kind, titleAr: '')]);

  @Deprecated('Use lastTurnOffers')
  static Future<({String id, String kind})?> lastOffer() async {
    final list = await lastTurnOffers();
    if (list.isEmpty) return null;
    return (id: list.first.id, kind: list.first.kind);
  }

  /// Brief injected into consultation statedGoal / system context.
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

  /// Parse explicit habitual prefs from a user message (not occasion budgets).
  static Future<void> absorbExplicitPrefsFromMessage(String message) async {
    if (!await isEnabled()) return;
    final text = message.trim();
    // Habitual budget: «عادة أحب تحت 150» / «ميزانيتي عادة تحت ١٥٠»
    final habit = RegExp(
      r'(عادة|دائم(?:اً|ا)|عموم(?:اً|ا)).{0,24}?(?:تحت|أقل من|باقل من)\s*(\d{2,5})',
    ).firstMatch(text);
    if (habit != null) {
      await saveHabitBudgetSar(int.tryParse(habit.group(2)!));
    }
    // Forget commands
    if (RegExp(r'انسَ?ي?\s*(تفضيلي|ميزانيتي|مدينتي)|لا تتذكرين|أوقفي التخصيص').hasMatch(text)) {
      await forgetAll();
      return;
    }
    final cityMatch = RegExp(r'(?:مدينتي|أسكن في|في)\s+(الرياض|جدة|جده|الدمام|مكة|المدينة)').firstMatch(text);
    if (cityMatch != null) {
      await saveCity(cityMatch.group(1));
    }
  }
}
