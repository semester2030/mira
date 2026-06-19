import 'package:shared_preferences/shared_preferences.dart';

import '../../features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';

/// Persists the user's last selected outfit analysis mode.
class OutfitAnalysisModeStorage {
  OutfitAnalysisModeStorage._();

  static const _key = 'mira_outfit_analysis_mode';

  static Future<OutfitAnalysisMode> load() async {
    final prefs = await SharedPreferences.getInstance();
    return switch (prefs.getString(_key)) {
      'quick' => OutfitAnalysisMode.quick,
      'smart' => OutfitAnalysisMode.smart,
      _ => OutfitAnalysisMode.quick,
    };
  }

  static Future<void> save(OutfitAnalysisMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    final value = switch (mode) {
      OutfitAnalysisMode.quick => 'quick',
      OutfitAnalysisMode.smart => 'smart',
    };
    await prefs.setString(_key, value);
  }
}
