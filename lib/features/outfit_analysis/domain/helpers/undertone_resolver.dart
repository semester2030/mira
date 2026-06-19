import '../../../skin_analysis/domain/entities/skin_report.dart';

enum SkinUndertone { warm, cool, neutral }

/// Resolves undertone from report fields when provider omits it.
abstract final class UndertoneResolver {
  UndertoneResolver._();

  static SkinUndertone resolve(SkinReport skin) {
    final en = skin.undertoneEn.trim().toLowerCase();
    if (en.contains('warm') || en.contains('داف')) return SkinUndertone.warm;
    if (en.contains('cool') || en.contains('بارد')) return SkinUndertone.cool;
    if (en.isNotEmpty || skin.undertone.trim().isNotEmpty) {
      return SkinUndertone.neutral;
    }

    final tone = '${skin.skinToneEn} ${skin.skinTone}'.toLowerCase();
    if (tone.contains('golden') ||
        tone.contains('peach') ||
        tone.contains('golden') ||
        tone.contains('ذهب') ||
        tone.contains('خوخ')) {
      return SkinUndertone.warm;
    }
    if (tone.contains('pink') ||
        tone.contains('rose') ||
        tone.contains('ورد') ||
        tone.contains('fair')) {
      return SkinUndertone.cool;
    }

    // Infer from redness vs radiance when undertone missing.
    final rednessIssue = _issueSeverity(skin, 'redness', fallbackField: skin.redness);
    final radiance = skin.concernScores['radiance'] ?? 60;
    if (rednessIssue > 55 && radiance < 50) return SkinUndertone.warm;
    if (radiance >= 68) return SkinUndertone.cool;
    return SkinUndertone.neutral;
  }

  static String labelAr(SkinUndertone undertone) => switch (undertone) {
        SkinUndertone.warm => 'دافئ',
        SkinUndertone.cool => 'بارد',
        SkinUndertone.neutral => 'محايد',
      };

  static int _issueSeverity(
    SkinReport skin,
    String concernKey, {
    required int fallbackField,
  }) {
    final health = skin.concernScores[concernKey];
    if (health != null) return (100 - health).clamp(0, 100);
    return (fallbackField * 20).clamp(0, 100);
  }
}
