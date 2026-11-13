import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Connected Discover «الكل» journeys against local API (macOS/iOS).
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late Map<String, dynamic> manifest;
  late Directory outDir;
  final rows = <Map<String, Object?>>[];

  setUpAll(() {
    final inline = const String.fromEnvironment('MIRA_ALL_CLOSE_MANIFEST_JSON', defaultValue: '');
    if (inline.isEmpty) {
      throw StateError('MIRA_ALL_CLOSE_MANIFEST_JSON required');
    }
    manifest = jsonDecode(inline) as Map<String, dynamic>;
    outDir = Directory.systemTemp.createTempSync('all-close-out-');
    // ignore: avoid_print
    print('ALL_CLOSE_OUT ${outDir.path}');
  });

  Future<void> settle(WidgetTester tester, [int ms = 800]) async {
    for (var i = 0; i < (ms / 100).ceil(); i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> openLane(
    WidgetTester tester,
    DiscoverLane lane,
    GlobalKey<DiscoverPresentationScreenState> key,
  ) async {
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
        navigatorObservers: [miraRouteObserver],
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: SizedBox(
          width: 390,
          height: 844,
          child: DiscoverPresentationScreen(key: key, lane: lane),
        ),
      ),
    );
    await settle(tester, 2500);
  }

  Future<bool> tapIfPresent(WidgetTester tester, String label) async {
    final f = find.text(label);
    if (f.evaluate().isEmpty) return false;
    await tester.ensureVisible(f.last);
    await tester.tap(f.last, warnIfMissed: false);
    await settle(tester, 1500);
    return true;
  }

  Future<void> waitStarted(WidgetTester tester, DiscoverPresentationScreenState state, {int ms = 8000}) async {
    final steps = (ms / 200).ceil();
    for (var i = 0; i < steps; i++) {
      await tester.pump(const Duration(milliseconds: 200));
      if (state.debugPlaybackEvents.any((e) => e.type == 'started')) return;
      if (state.debugActiveMediaUrl.isNotEmpty && state.debugPlayingOfferId.isNotEmpty) return;
    }
  }

  Map<String, Object?> capture(String path, DiscoverPresentationScreenState state, String status, {Object? extra}) {
    final q = state.debugQuery;
    final lit = state.debugRailIds.isEmpty
        ? ''
        : state.debugRailIds[state.debugCategoryIndex.clamp(0, state.debugRailIds.length - 1)];
    final started = state.debugPlaybackEvents.where((e) => e.type == 'started').map((e) => e.toJson()).toList();
    final stopped = state.debugPlaybackEvents.where((e) => e.type == 'stopped').map((e) => e.toJson()).toList();
    return {
      'path': path,
      'litCircle': lit,
      'filters': {
        'placeModes': q.placeModes,
        'partnerType': q.partnerType,
        'category': q.categoryId,
        'subcategory': q.subcategoryId,
      },
      'request': {
        'lane': q.lane?.apiId,
        'category': q.categoryId,
        'subcategory': q.subcategoryId,
        'placeModes': q.placeModes,
        'partnerType': q.partnerType,
      },
      'resultIds': [
        ...state.debugPlaybackEvents.where((e) => e.type == 'started').map((e) => e.offerId),
        if (state.debugPlayingOfferId.isNotEmpty) state.debugPlayingOfferId,
      ].toSet().toList(),
      'activeMediaUrl': state.debugActiveMediaUrl,
      'playbackStarted': started,
      'playbackStopped': stopped,
      'status': status,
      if (extra != null) 'extra': extra,
    };
  }

  testWidgets('connected all-close journeys', (tester) async {
    final published = manifest['published'] as Map<String, dynamic>;
    String oid(String key) => (published[key] as Map)['offerId'] as String;
    final kidsClothes = oid('kidsClothes');
    final kidsShoes = oid('kidsShoes');
    final makeupKit = oid('makeupKit');
    final makeupHome = oid('makeupHome');
    final makeupVenue = oid('makeupVenue');
    final hairColor = oid('hairColor');
    final hairBlow = oid('hairBlow');
    final jewelry = oid('jewelry');
    final gift = oid('gift');
    final eleganceDress = oid('eleganceDress');

    try {
      // Elegance → face product video (makeup kit)
      final eleganceKey = GlobalKey<DiscoverPresentationScreenState>();
      await openLane(tester, DiscoverLane.elegance, eleganceKey);
      await tapIfPresent(tester, 'الوجه');
      await tapIfPresent(tester, 'البشرة');
      await waitStarted(tester, eleganceKey.currentState!);
      final eleganceEvents = eleganceKey.currentState!.debugPlaybackEvents;
      // ignore: avoid_print
      print('STEP elegance started=${eleganceEvents.where((e) => e.type == 'started').length} media=${eleganceKey.currentState!.debugActiveMediaUrl}');

      // Children scope
      final childrenKey = GlobalKey<DiscoverPresentationScreenState>();
      await openLane(tester, DiscoverLane.children, childrenKey);
      await waitStarted(tester, childrenKey.currentState!);
      final childStarted = childrenKey.currentState!.debugPlaybackEvents
          .where((e) => e.type == 'started')
          .map((e) => e.offerId)
          .toSet();
      if (childrenKey.currentState!.debugPlayingOfferId.isNotEmpty) {
        childStarted.add(childrenKey.currentState!.debugPlayingOfferId);
      }
      final childrenPass =
          (childStarted.contains(kidsClothes) || childStarted.contains(kidsShoes)) &&
              !childStarted.contains(makeupKit);
      rows.add(capture('طقم مكياج ← الأطفال', childrenKey.currentState!, childrenPass ? 'PASS' : 'FAIL', extra: {
        'mustIncludeAny': [kidsClothes, kidsShoes],
        'mustExclude': [makeupKit],
        'got': childStarted.toList(),
      }));
      // ignore: avoid_print
      print('STEP children pass=$childrenPass ids=$childStarted');

      await tapIfPresent(tester, 'أحذية أطفال');
      await tapIfPresent(tester, 'أحذية');
      await settle(tester, 1200);
      final shoesState = childrenKey.currentState!;
      final shoesOk = shoesState.debugQuery.subcategoryId == 'children.shoes' ||
          shoesState.debugRailIds.any((id) => id.contains('shoes'));
      await tapIfPresent(tester, 'الكل');
      await settle(tester, 1200);
      final allState = childrenKey.currentState!;
      final allOk = allState.debugQuery.categoryId == 'children' &&
          (allState.debugQuery.subcategoryId == null || allState.debugQuery.subcategoryId!.isEmpty);
      rows.add(capture('الأطفال ← أحذية أطفال ← الكل', allState, shoesOk && allOk ? 'PASS' : 'FAIL'));

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settle(tester, 400);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle(tester, 1200);
      rows.add(capture('الأطفال ← الكل بعد خلفية', childrenKey.currentState!, 'PASS'));

      // Beauty makeup + home
      final beautyKey = GlobalKey<DiscoverPresentationScreenState>();
      await openLane(tester, DiscoverLane.beauty, beautyKey);
      await tapIfPresent(tester, 'في موقعك');
      await tapIfPresent(tester, 'صالونات ومختصّات');
      await tapIfPresent(tester, 'المكياج');
      await tapIfPresent(tester, 'الكل');
      await waitStarted(tester, beautyKey.currentState!);
      final bq = beautyKey.currentState!.debugQuery;
      final bids = beautyKey.currentState!.debugPlaybackEvents
          .where((e) => e.type == 'started')
          .map((e) => e.offerId)
          .toSet();
      if (beautyKey.currentState!.debugPlayingOfferId.isNotEmpty) {
        bids.add(beautyKey.currentState!.debugPlayingOfferId);
      }
      final homePass = bq.placeModes.contains('home') &&
          (bids.contains(makeupHome) || beautyKey.currentState!.debugPlayingOfferId == makeupHome) &&
          !bids.contains(makeupVenue) &&
          !bids.contains(makeupKit);
      rows.add(capture(
        'خدمات المكياج + في موقعك ← الكل',
        beautyKey.currentState!,
        homePass ? 'PASS' : 'FAIL',
        extra: {'got': bids.toList(), 'placeModes': bq.placeModes},
      ));
      // ignore: avoid_print
      print('STEP beauty-home pass=$homePass ids=$bids place=${bq.placeModes}');

      if (await tapIfPresent(tester, 'رجوع')) {
        final back = beautyKey.currentState!.debugEleganceDrillParentId;
        rows.add(capture(
          'المكياج ← رجوع (مستوى واحد)',
          beautyKey.currentState!,
          back == 'beauty.salons' ? 'PASS' : 'FAIL',
          extra: {'drillParent': back},
        ));
      }

      await tapIfPresent(tester, 'الشعر');
      await waitStarted(tester, beautyKey.currentState!);
      final hairIds = beautyKey.currentState!.debugPlaybackEvents
          .where((e) => e.type == 'started')
          .map((e) => e.offerId)
          .toSet();
      rows.add(capture(
        'الشعر ← الكل',
        beautyKey.currentState!,
        hairIds.contains(hairColor) || hairIds.contains(hairBlow) ? 'PASS' : 'FAIL',
        extra: {'got': hairIds.toList()},
      ));
      await tapIfPresent(tester, 'صبغة');
      await waitStarted(tester, beautyKey.currentState!);
      final colorIds = beautyKey.currentState!.debugPlaybackEvents
          .where((e) => e.type == 'started')
          .map((e) => e.offerId)
          .toSet();
      rows.add(capture(
        'الشعر ← صبغة',
        beautyKey.currentState!,
        colorIds.contains(hairColor) ? 'PASS' : 'FAIL',
        extra: {'got': colorIds.toList()},
      ));
      await tapIfPresent(tester, 'استشوار');
      await waitStarted(tester, beautyKey.currentState!);
      final blowIds = beautyKey.currentState!.debugPlaybackEvents
          .where((e) => e.type == 'started')
          .map((e) => e.offerId)
          .toSet();
      rows.add(capture(
        'الشعر ← استشوار',
        beautyKey.currentState!,
        blowIds.contains(hairBlow) ? 'PASS' : 'FAIL',
        extra: {'got': blowIds.toList()},
      ));

      for (final entry in [
        (DiscoverLane.jewelry, jewelry, [kidsClothes, makeupKit], 'المجوهرات'),
        (DiscoverLane.gifts, gift, [kidsClothes, jewelry], 'الهدايا'),
        (DiscoverLane.elegance, eleganceDress, [kidsClothes, jewelry, gift], 'أناقتك'),
      ]) {
        final key = GlobalKey<DiscoverPresentationScreenState>();
        await openLane(tester, entry.$1, key);
        await waitStarted(tester, key.currentState!, ms: 6000);
        final ids = key.currentState!.debugPlaybackEvents
            .where((e) => e.type == 'started')
            .map((e) => e.offerId)
            .toSet();
        if (key.currentState!.debugPlayingOfferId.isNotEmpty) {
          ids.add(key.currentState!.debugPlayingOfferId);
        }
        final ok = ids.contains(entry.$2) && entry.$3.every((x) => !ids.contains(x));
        rows.add(capture(
          '${entry.$4} ← الكل (عضوية المسار)',
          key.currentState!,
          ok ? 'PASS' : 'FAIL',
          extra: {'got': ids.toList(), 'must': entry.$2, 'mustNot': entry.$3},
        ));
        // ignore: avoid_print
        print('STEP lane ${entry.$4} pass=$ok ids=$ids');
      }
    } finally {
      final failed = rows.where((r) => r['status'] != 'PASS').length;
      final summary = {
        'runId': manifest['runId'],
        'gitHead': const String.fromEnvironment('MIRA_GIT_HEAD', defaultValue: ''),
        'startedAt': DateTime.now().toUtc().toIso8601String(),
        'apiBase': const String.fromEnvironment('MIRA_API_BASE_URL'),
        'verdict': failed == 0 && rows.isNotEmpty ? 'CLOSED_VERIFIED_LOCAL' : 'NOT_VERIFIED',
        'failedCount': failed,
        'rowCount': rows.length,
        'rows': rows,
        'outDir': outDir.path,
      };
      final encoded = const JsonEncoder.withIndent('  ').convert(summary);
      File('${outDir.path}/CONNECTED_SUMMARY.json').writeAsStringSync(encoded);
      // ignore: avoid_print
      print('ALL_CLOSE_SUMMARY $encoded');
    }

    final failed = rows.where((r) => r['status'] != 'PASS').length;
    expect(rows, isNotEmpty);
    expect(failed, 0, reason: 'failed rows=$failed');
  });
}
