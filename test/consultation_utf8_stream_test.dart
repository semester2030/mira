import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/consultation/data/datasources/consultation_stream_data_source.dart';

void main() {
  test('splits inside an arabic letter and a four-byte emoji', () {
    final decoder = ConsultationUtf8Decoder();
    final bytes = utf8.encode('حذاء 👗');
    final firstChar = utf8.encode('ح');
    expect(firstChar.length, 2);
    expect(utf8.encode('👗').length, 4);
    final emojiAt = bytes.length - 4;
    final first = decoder.add(bytes.sublist(0, 1));
    final second = decoder.add(bytes.sublist(1, emojiAt + 2));
    final third = decoder.add(bytes.sublist(emojiAt + 2), end: true);
    expect('$first$second$third', 'حذاء 👗');
  });

  test('unfinished sequence at the end is an arabic error', () {
    final decoder = ConsultationUtf8Decoder();
    final bytes = utf8.encode('ب');
    expect(
      () => decoder.add(bytes.sublist(0, 1), end: true),
      throwsA(isA<ConsultationStreamException>()),
    );
  });
}
