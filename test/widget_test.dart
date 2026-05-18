import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/shared/widgets/premium/premium_button.dart';

void main() {
  testWidgets('PremiumButton renders label', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PremiumButton(
            label: 'اختبار',
            onPressed: null,
          ),
        ),
      ),
    );

    expect(find.text('اختبار'), findsOneWidget);
  });
}
