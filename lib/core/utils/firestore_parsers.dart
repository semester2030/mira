import 'package:cloud_firestore/cloud_firestore.dart';

/// Normalizes Firestore field types (Timestamp, num) for app models.
abstract final class FirestoreParsers {
  FirestoreParsers._();

  static String string(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    if (value is String) return value;
    return value.toString();
  }

  static int integer(dynamic value, {int fallback = 0}) {
    if (value == null) return fallback;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return fallback;
  }

  static DateTime dateTime(dynamic value, {DateTime? fallback}) {
    if (value == null) return fallback ?? DateTime.now();
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? fallback ?? DateTime.now();
    }
    return fallback ?? DateTime.now();
  }

  /// `lastActive` — Timestamp (مفضّل)، ISO، أو نص قديم.
  static String lastActiveLabel(dynamic value, {String fallback = '—'}) {
    if (value == null) return fallback;
    if (value is Timestamp) return _formatRelative(value.toDate());
    if (value is DateTime) return _formatRelative(value);
    if (value is String) {
      if (value == 'الآن') return 'اليوم';
      final parsed = DateTime.tryParse(value);
      if (parsed != null) return _formatRelative(parsed);
      if (value.isNotEmpty) return value;
    }
    return fallback;
  }

  static String _formatRelative(DateTime dt) {
    final local = dt.toLocal();
    final now = DateTime.now();
    final diff = now.difference(local);
    if (diff.inMinutes < 2) return 'الآن';
    if (diff.inHours < 1) return 'منذ ${diff.inMinutes} د';
    if (diff.inDays < 1) return 'اليوم';
    if (diff.inDays == 1) return 'أمس';
    if (diff.inDays < 7) return 'منذ ${diff.inDays} أيام';
    return '${local.day}/${local.month}/${local.year}';
  }
}
