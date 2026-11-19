import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart';

Future<void> loadDiscoverFonts() async {
  Future<ByteData> fileBytes(String path) async {
    final bytes = File(path).readAsBytesSync();
    return ByteData.sublistView(Uint8List.fromList(bytes));
  }

  final root = Platform.environment['FLUTTER_ROOT'] ?? '/Users/fayez/flutter';
  final icons = FontLoader('MaterialIcons')
    ..addFont(fileBytes('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf'));
  await icons.load();
  final tajawal = FontLoader('Tajawal')
    ..addFont(fileBytes('assets/fonts/Tajawal-Regular.ttf'))
    ..addFont(fileBytes('assets/fonts/Tajawal-Medium.ttf'))
    ..addFont(fileBytes('assets/fonts/Tajawal-Bold.ttf'));
  await tajawal.load();
  final playfair = FontLoader('Playfair Display')..addFont(fileBytes('assets/fonts/PlayfairDisplay-Variable.ttf'));
  await playfair.load();
}
