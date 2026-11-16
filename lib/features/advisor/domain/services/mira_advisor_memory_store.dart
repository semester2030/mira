import 'package:shared_preferences/shared_preferences.dart';

/// Cross-session preferences the customer explicitly allows Mira to remember.
/// Session messages stay separate; disabling memory does not disable chat.
class MiraAdvisorMemoryStore {
  MiraAdvisorMemoryStore._();

  static const _kEnabled = 'mira_advisor_memory_enabled';
  static const _kBudgetHabit = 'mira_advisor_pref_budget_habit_sar';
  static const _kCity = 'mira_advisor_pref_city';
  static const _kNotes = 'mira_advisor_pref_notes_ar';
  static const _kLastOfferId = 'mira_advisor_last_offer_id';
  static const _kLastOfferKind = 'mira_advisor_last_offer_kind';
  static const _kAccountScope = 'mira_advisor_memory_uid';

  static Future<bool> isEnabled() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_kEnabled) ?? true;
  }

  static Future<void> setEnabled(bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, value);
  }

  static Future<void> bindAccount(String? uid) async {
    final p = await SharedPreferences.getInstance();
    final previous = p.getString(_kAccountScope);
    if (uid == null || uid.isEmpty) return;
    if (previous != null && previous != uid) {
      await clearPreferences();
    }
    await p.setString(_kAccountScope, uid);
  }

  static Future<void> clearPreferences() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_kBudgetHabit);
    await p.remove(_kCity);
    await p.remove(_kNotes);
    await p.remove(_kLastOfferId);
    await p.remove(_kLastOfferKind);
  }

  static Future<void> forgetAll() async {
    await clearPreferences();
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, false);
  }

  static Future<void> saveHabitBudgetSar(int? sar) async {
    if (!await isEnabled()) return;
    final p = await SharedPreferences.getInstance();
    if (sar == null) {
      await p.remove(_kBudgetHabit);
    } else {
      await p.setInt(_kBudgetHabit, sar);
    }
  }

  static Future<int?> habitBudgetSar() async {
    if (!await isEnabled()) return null;
    final p = await SharedPreferences.getInstance();
    return p.getInt(_kBudgetHabit);
  }

  static Future<void> saveCity(String? city) async {
    if (!await isEnabled()) return;
    final p = await SharedPreferences.getInstance();
    final v = city?.trim() ?? '';
    if (v.isEmpty) {
      await p.remove(_kCity);
    } else {
      await p.setString(_kCity, v);
    }
  }

  static Future<String?> city() async {
    if (!await isEnabled()) return null;
    final p = await SharedPreferences.getInstance();
    return p.getString(_kCity);
  }

  /// Occasion budgets must NOT be written here — only habitual prefs.
  static Future<void> rememberLastOffer({
    required String id,
    required String kind,
  }) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kLastOfferId, id);
    await p.setString(_kLastOfferKind, kind);
  }

  static Future<({String id, String kind})?> lastOffer() async {
    final p = await SharedPreferences.getInstance();
    final id = p.getString(_kLastOfferId);
    final kind = p.getString(_kLastOfferKind);
    if (id == null || id.isEmpty || kind == null || kind.isEmpty) return null;
    return (id: id, kind: kind);
  }

  static Future<String?> preferenceBriefAr() async {
    if (!await isEnabled()) return null;
    final budget = await habitBudgetSar();
    final cityName = await city();
    final parts = <String>[
      if (budget != null) 'عادة تحبّين خيارات تحت $budget ريال',
      if (cityName != null && cityName.isNotEmpty) 'المدينة: $cityName',
    ];
    if (parts.isEmpty) return null;
    return parts.join(' · ');
  }
}
