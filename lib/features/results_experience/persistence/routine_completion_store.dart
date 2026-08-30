import 'package:shared_preferences/shared_preferences.dart';

/// Local behavioral completion state for Personal Plan steps.
/// Does not mutate frozen analysis evidence.
class RoutineCompletionStore {
  RoutineCompletionStore({
    required this.userId,
    required this.analysisId,
    SharedPreferences? prefs,
  }) : _prefs = prefs;

  final String userId;
  final String analysisId;
  SharedPreferences? _prefs;

  static String dateKey(DateTime day) {
    final y = day.year.toString().padLeft(4, '0');
    final m = day.month.toString().padLeft(2, '0');
    final d = day.day.toString().padLeft(2, '0');
    return '$y$m$d';
  }

  String _key(String stepId, DateTime day) =>
      'mira_routine_done_${userId}_${analysisId}_${dateKey(day)}_$stepId';

  Future<SharedPreferences> _ensure() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  Future<bool> isComplete(String stepId, DateTime day) async {
    final prefs = await _ensure();
    return prefs.getBool(_key(stepId, day)) ?? false;
  }

  Future<void> setComplete(
    String stepId,
    DateTime day, {
    required bool complete,
  }) async {
    final prefs = await _ensure();
    final key = _key(stepId, day);
    if (complete) {
      await prefs.setBool(key, true);
    } else {
      await prefs.remove(key);
    }
  }

  Future<Map<String, bool>> loadForSteps(
    Iterable<String> stepIds,
    DateTime day,
  ) async {
    final prefs = await _ensure();
    final out = <String, bool>{};
    for (final id in stepIds) {
      out[id] = prefs.getBool(_key(id, day)) ?? false;
    }
    return out;
  }
}
