import 'package:intl/intl.dart';

/// أداة لتنسيق التواريخ في التطبيق
class DateFormatter {
  /// تنسيق التاريخ إلى نص (افتراضي: yyyy-MM-dd)
  static String format(DateTime date, {String pattern = 'yyyy-MM-dd'}) {
    return DateFormat(pattern).format(date);
  }

  /// تحويل نص إلى تاريخ
  static DateTime? parse(String dateString, {String pattern = 'yyyy-MM-dd'}) {
    try {
      return DateFormat(pattern).parse(dateString);
    } catch (_) {
      return null;
    }
  }
}
