import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/profile/user_level.dart';

void main() {
  group('UserLevel', () {
    test('fromPoints tiers', () {
      expect(UserLevel.fromPoints(0), 'مبتدئة');
      expect(UserLevel.fromPoints(99), 'مبتدئة');
      expect(UserLevel.fromPoints(100), 'متقدمة');
      expect(UserLevel.fromPoints(200), 'محترفة');
      expect(UserLevel.fromPoints(400), 'خبيرة ميرا');
    });

    test('progressToNext is clamped', () {
      expect(UserLevel.progressToNext(50), greaterThan(0));
      expect(UserLevel.progressToNext(50), lessThanOrEqualTo(1));
      expect(UserLevel.progressToNext(500), 1);
    });
  });
}
