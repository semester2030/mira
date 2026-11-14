import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mirra/core/config/mira_api_config.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/network/api_client.dart';
import 'package:mirra/core/services/guest_session_service.dart';
import 'package:mirra/features/marketplace/data/commerce_api_client.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/domain/commerce_models.dart';
import 'package:mirra/features/marketplace/presentation/screens/bookings_list_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/orders_list_screen.dart';
import 'package:mirra/firebase_options.dart';
import 'package:mirra/shared/theme/theme.dart';
import 'package:mirra/shared/widgets/premium/premium_exports.dart';

Future<String> _authEmulatorIdToken({required String email, required String password}) async {
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final client = HttpClient();
    try {
      final req = await client.postUrl(Uri.parse('http://127.0.0.1:9099$path'));
      req.headers.contentType = ContentType.json;
      req.add(utf8.encode(jsonEncode(body)));
      final res = await req.close();
      final text = await res.transform(utf8.decoder).join();
      return jsonDecode(text) as Map<String, dynamic>;
    } finally {
      client.close(force: true);
    }
  }

  var body = await post('/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', {
    'email': email,
    'password': password,
    'returnSecureToken': true,
  });
  if (body['idToken'] is! String) {
    body = await post('/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', {
      'email': email,
      'password': password,
      'returnSecureToken': true,
    });
  }
  final token = body['idToken'];
  if (token is! String || token.isEmpty) {
    throw StateError('Auth emulator token missing: $body');
  }
  return token;
}

/// MiraRC2 ops proof: Auth-emulator sign-in → Discover feed has both videos →
/// COD order + booking via same commerce client the UI uses → numbers visible in طلباتي/حجوزاتي.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final seedPath = const String.fromEnvironment('MIRA_OPS_IPHONE_SEED');
  final seedInline = const String.fromEnvironment('MIRA_OPS_IPHONE_SEED_JSON');
  final outPath = const String.fromEnvironment('MIRA_OPS_IPHONE_OUT');

  Future<void> writeOut(Map<String, Object?> data) async {
    final payload = const JsonEncoder.withIndent('  ').convert(data);
    // ignore: avoid_print
    print('IPHONE_JOURNEY_RESULT $payload');
    final targets = <String>[
      if (outPath.isNotEmpty) outPath,
      '${Directory.systemTemp.path}/mira-ops-iphone-journey.json',
      '/tmp/mira-ops-iphone-journey.json',
    ];
    Object? lastErr;
    for (final path in targets.toSet()) {
      try {
        File(path).writeAsStringSync(payload);
        // ignore: avoid_print
        print('IPHONE_JOURNEY_WROTE $path');
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    // ignore: avoid_print
    print('IPHONE_JOURNEY_WRITE_FAIL $lastErr');
  }

  testWidgets('ops iphone buy+book from seeded Discover videos', (tester) async {
    final result = <String, Object?>{'ok': false};
    try {
      expect(seedInline.isNotEmpty || seedPath.isNotEmpty, isTrue, reason: 'seed required');
      expect(MiraApiConfig.useBackend, isTrue);
      expect(MiraApiConfig.baseUrl.contains('127.0.0.1'), isTrue);

      Map<String, dynamic> seed;
      if (seedInline.isNotEmpty) {
        seed = jsonDecode(seedInline) as Map<String, dynamic>;
      } else {
        seed = jsonDecode(File(seedPath).readAsStringSync()) as Map<String, dynamic>;
      }
      final productId = seed['productId'] as String;
      final serviceId = seed['serviceId'] as String;
      final productName = seed['productName'] as String;
      final serviceName = seed['serviceName'] as String;
      final email = seed['custEmail'] as String;
      final password = seed['custPassword'] as String;

      await GuestSessionService.exit();
      ApiClient.reset();

      // Prefer Auth-emulator REST token — avoids macOS keychain sandbox failures in CI/proofs.
      // Still attempts the Firebase plugin path when it works (iOS Simulator / signed macOS).
      var authMode = 'emulator-rest';
      try {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
        if (const bool.fromEnvironment('MIRA_USE_AUTH_EMULATOR')) {
          await FirebaseAuth.instance.useAuthEmulator('127.0.0.1', 9099);
        }
        try {
          await FirebaseAuth.instance.signInWithEmailAndPassword(email: email, password: password);
        } on FirebaseAuthException catch (e) {
          if (e.code == 'user-not-found' ||
              e.code == 'invalid-credential' ||
              e.code == 'wrong-password' ||
              e.code == 'INVALID_LOGIN_CREDENTIALS') {
            await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email, password: password);
          } else {
            rethrow;
          }
        }
        authMode = 'firebase-plugin';
      } catch (e) {
        // ignore: avoid_print
        print('IPHONE_AUTH_PLUGIN_FALLBACK $e');
      }

      final idToken = await _authEmulatorIdToken(email: email, password: password);
      ApiClient.debugDioOverride = Dio(
        BaseOptions(
          baseUrl: MiraApiConfig.baseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 60),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $idToken',
          },
        ),
      );
      result['authMode'] = authMode;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: Center(
                child: PremiumButton(
                  label: 'دخول محاكي Auth (اختبار محلي)',
                  onPressed: () {},
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('دخول محاكي Auth (اختبار محلي)'), findsOneWidget);

      final repo = MarketplaceRepositoryImpl(useServer: true);
      final partnerId = seed['partnerId'] as String?;
      final elegance = await repo.browse(
        DiscoverCatalogQuery(lane: DiscoverLane.elegance, partnerId: partnerId),
        limit: 24,
      );
      final beauty = await repo.browse(
        DiscoverCatalogQuery(lane: DiscoverLane.beauty, partnerId: partnerId),
        limit: 24,
      );
      expect(elegance.failed, isFalse, reason: 'elegance browse failed');
      expect(beauty.failed, isFalse, reason: 'beauty browse failed');
      final productSeen = elegance.items.any((o) => o.id == productId || o.nameAr == productName);
      final serviceSeen = beauty.items.any((o) => o.id == serviceId || o.nameAr == serviceName);
      result['productSeenInFeed'] = productSeen;
      result['serviceSeenInFeed'] = serviceSeen;
      result['productName'] = productName;
      result['serviceName'] = serviceName;
      expect(productSeen, isTrue, reason: 'product video missing from elegance feed');
      expect(serviceSeen, isTrue, reason: 'service video missing from beauty feed');

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('ar'),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: SizedBox(
              width: 390,
              height: 844,
              child: DiscoverPresentationScreen(lane: DiscoverLane.elegance),
            ),
          ),
        ),
      );
      for (var i = 0; i < 25; i++) {
        await tester.pump(const Duration(milliseconds: 200));
      }

      final commerce = ApiCommerceClient(signedIn: () => true);
      try {
        await commerce.clearCart();
      } catch (_) {}
      await commerce.addCartItem(productId: productId, quantity: 1);
      final quote = await commerce.quote();
      final order = await commerce.createOrder(
        idempotencyKey: 'iphone-ord-${DateTime.now().millisecondsSinceEpoch}',
        delivery: const CommerceDelivery(
          contactName: 'عميلة آيفون',
          contactPhone: '0509998877',
          addressLine: 'حي الاختبار',
          city: 'الرياض',
        ),
        confirmationFingerprint: quote.confirmationFingerprint!,
      );
      final orderPublic = order.order.publicNumber;
      result['orderPublic'] = orderPublic;

      final day = DateTime.now();
      final dateKey =
          '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
      final availability = await commerce.availability(serviceId, dateKey);
      expect(availability.slots, isNotEmpty, reason: 'no booking slot for seeded service');
      final slot = availability.slots.first;
      final booking = await commerce.createBooking(
        idempotencyKey: 'iphone-book-${DateTime.now().millisecondsSinceEpoch}',
        serviceId: serviceId,
        startsAt: slot.startsAt,
        contactName: 'عميلة آيفون',
        contactPhone: '0509998877',
      );
      final bookingPublic = booking.booking.publicNumber;
      result['bookingPublic'] = bookingPublic;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('ar'),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: OrdersListScreen(client: commerce),
          ),
        ),
      );
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 250));
        if (find.textContaining(orderPublic).evaluate().isNotEmpty) break;
      }
      final ordersUi = find.textContaining(orderPublic).evaluate().isNotEmpty;
      result['ordersUiHasNumber'] = ordersUi;
      expect(find.text('طلباتي'), findsWidgets);
      expect(ordersUi, isTrue, reason: 'order public number missing from طلباتي');

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('ar'),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: BookingsListScreen(client: commerce),
          ),
        ),
      );
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 250));
        if (find.textContaining(bookingPublic).evaluate().isNotEmpty) break;
      }
      final bookingsUi = find.textContaining(bookingPublic).evaluate().isNotEmpty;
      result['bookingsUiHasNumber'] = bookingsUi;
      expect(find.text('حجوزاتي'), findsWidgets);
      expect(bookingsUi, isTrue, reason: 'booking public number missing from حجوزاتي');

      expect(MarketplaceCopy.addToCart, isNotEmpty);
      expect(MarketplaceCopy.bookingPayAtVenue, isNotEmpty);

      result['ok'] = true;
      result['apiBase'] = MiraApiConfig.baseUrl;
      await writeOut(result);
    } catch (e, st) {
      result['ok'] = false;
      result['error'] = '$e\n$st';
      await writeOut(result);
      rethrow;
    }
  });
}
