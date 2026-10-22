/// Strip raw Markdown markers and technical noise for live Arabic chat display.
abstract final class MceDisplayText {
  MceDisplayText._();

  static String sanitize(String raw) {
    var text = raw;
    // Bold / italic markers left visible during stream.
    text = text.replaceAllMapped(
      RegExp(r'\*\*([^*]+)\*\*'),
      (m) => m.group(1) ?? '',
    );
    text = text.replaceAllMapped(
      RegExp(r'\*([^*]+)\*'),
      (m) => m.group(1) ?? '',
    );
    text = text.replaceAllMapped(
      RegExp(r'`([^`]+)`'),
      (m) => m.group(1) ?? '',
    );
    text = text.replaceAll(RegExp(r'^#{1,6}\s+', multiLine: true), '');
    text = text.replaceAll(RegExp(r'\[([^\]]+)\]\([^)]+\)'), r'$1');
    // Drop obvious technical ids / codes from user-facing bubbles.
    text = text.replaceAll(
      RegExp(r'\b(MCE_[A-Z0-9_]+|OUTFIT_[A-Z0-9_]+|clientMessageId)\b'),
      '',
    );
    text = text.replaceAll(RegExp(r'[ \t]+\n'), '\n');
    text = text.replaceAll(RegExp(r'\n{3,}'), '\n\n');
    return text.trim();
  }
}
