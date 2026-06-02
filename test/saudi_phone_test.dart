import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/utils/saudi_phone.dart';

void main() {
  group('SaudiPhone', () {
    test('toE164 accepts 05xxxxxxxx', () {
      expect(SaudiPhone.toE164('0501234567'), '+966501234567');
    });

    test('toE164 accepts 5xxxxxxxx', () {
      expect(SaudiPhone.toE164('501234567'), '+966501234567');
    });

    test('toE164 rejects invalid', () {
      expect(SaudiPhone.toE164('0401234567'), isNull);
      expect(SaudiPhone.toE164('123'), isNull);
    });

    test('display formats E.164', () {
      expect(SaudiPhone.display('+966501234567'), '0501234567');
    });
  });
}
