import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/dashboard/presentation/widgets/ask_mira_home_entry.dart';

void main() {
  test('avatar logical size stays in handoff range 76–84', () {
    expect(AskMiraHomeEntry.avatarLogicalSize, inInclusiveRange(76, 84));
  });

  test('home entry widget constructs', () {
    const w = AskMiraHomeEntry();
    expect(w.key, isNull);
    expect(AskMiraHomeEntry.avatarLogicalSize, 80);
  });
}
