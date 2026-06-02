import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/analysis_navigation.dart';
import 'package:mirra/core/navigation/app_navigator.dart';
import 'package:mirra/core/services/guest_session_service.dart';
import 'package:mirra/core/services/privacy_consent_storage.dart';
import 'package:mirra/features/privacy/presentation/screens/privacy_consent_screen.dart';
import 'package:mirra/shared/widgets/analysis_launch_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      'mira_privacy_accepted_v1': true,
      'mirra_guest_mode': true,
    });
    await GuestSessionService.load();
    expect(await PrivacyConsentStorage.isAccepted(), isTrue);
  });

  testWidgets('AnalysisLaunchCard onPressed fires', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AnalysisLaunchCard(
            onPressed: () => tapped = true,
            child: const Text('حلّلي بشرتك'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('حلّلي بشرتك'));
    await tester.pump();
    expect(tapped, isTrue);
  });

  testWidgets('privacy consent gate opens before analysis', (tester) async {
    SharedPreferences.setMockInitialValues({'mirra_guest_mode': true});
    await GuestSessionService.load();
    expect(await PrivacyConsentStorage.isAccepted(), isFalse);

    late BuildContext hostContext;
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: rootNavigatorKey,
        home: Builder(
          builder: (context) {
            hostContext = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    unawaited(AnalysisNavigation.openSkinAnalysis(hostContext));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(PrivacyConsentScreen), findsOneWidget);
  });
}
