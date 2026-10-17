import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/consultation/data/datasources/consultation_stream_data_source.dart';

void main() {
  test('arabic and emoji split across chunks stay intact', () {
    final decoder = ConsultationUtf8Decoder();
    final bytes = utf8.encode('إطلالة ✨ مرطب');
    final split = bytes.length ~/ 2;
    final first = decoder.add(bytes.sublist(0, split));
    final second = decoder.add(bytes.sublist(split), end: true);
    expect('$first$second', 'إطلالة ✨ مرطب');
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
