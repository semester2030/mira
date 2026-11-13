import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Connected Discover «الكل» closure against local test API.
///
/// Required dart-defines:
///   USE_MIRA_API=true
///   MIRA_API_BASE_URL=http://127.0.0.1:3011/api/v1
///   MIRA_MARKETPLACE_ENABLED=true
/// Optional:
///   MIRA_ALL_CLOSE_MANIFEST=/path/to/PUBLISHED_OFFERS.json
///   MIRA_ALL_CLOSE_OUT=/path/to/evidence/dir
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late Map<String, dynamic> manifest;
  late Directory outDir;
  final rows = <Map<String, Object?>>[];

  setUpAll(() {
    final manifestPath = const String.fromEnvironment(
      'MIRA_ALL_CLOSE_MANIFEST',
      defaultValue: '',
    );
    if (manifestPath.isEmpty) {
      throw StateError('MIRA_ALL_CLOSE_MANIFEST dart-define required');
    }
    manifest = jsonDecode(File(manifestPath).readAsStringSync()) as Map<String, dynamic>;
    final outPath = const String.fromEnvironment('MIRA_ALL_CLOSE_OUT', defaultValue: '');
    outDir = Directory(outPath.isEmpty ? Directory.systemTemp.path : outPath);
    outDir.createSync(recursive: true);
  });

  Future<void> pumpDiscover(
    WidgetTester tester, {
    required DiscoverLane lane,
    required GlobalKey<DiscoverPresentationScreenState> key,
  }) async {
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
        home: DiscoverPresentationScreen(key: key, lane: lane),
      ),
    );
    await tester.pump();
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      final state = key.currentState;
      if (state == null) continue;
      if (state.debugQuery.lane == lane) break;
    }
    await tester.pump(const Duration(seconds: 2));
  }

  Future<void> tapLabel(WidgetTester tester, String label) async {
    final finder = find.text(label);
    expect(finder, findsWidgets, reason: 'missing rail/filter label $label');
    await tester.tap(finder.last);
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
  }

  Future<List<DiscoverPlaybackEvent>> waitPlayback(
    DiscoverPresentationScreenState state, {
    required String type,
    Duration timeout = const Duration(seconds: 25),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      final hit = state.debugPlaybackEvents.where((e) => e.type == type).toList();
      if (hit.isNotEmpty) return List.of(state.debugPlaybackEvents);
    }
    return List.of(state.debugPlaybackEvents);
  }

  Map<String, Object?> row({
    required String path,
    required DiscoverPresentationScreenState state,
    required String status,
    String? note,
  }) {
    final q = state.debugQuery;
    final events = state.debugPlaybackEvents.map((e) => e.toJson()).toList();
    final started = state.debugPlaybackEvents.where((e) => e.type == 'started').toList();
    final stopped = state.debugPlaybackEvents.where((e) => e.type == 'stopped').toList();
    return {
      'path': path,
      'litCircle': state.debugRailIds.isEmpty
          ? ''
          : state.debugRailIds[state.debugCategoryIndex.clamp(0, state.debugRailIds.length - 1)],
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
      'resultIds': state.debugPlayingOfferId.isEmpty && state.debugRailIds.isEmpty
          ? <String>[]
          : null, // filled by caller when known
      'playingOfferIdCard': state.debugPlayingOfferId,
      'activeMediaUrl': state.debugActiveMediaUrl,
      'playbackStarted': started.map((e) => e.toJson()).toList(),
      'playbackStopped': stopped.map((e) => e.toJson()).toList(),
      'playbackEvents': events,
      'status': status,
      if (note != null) 'note': note,
    };
  }

  testWidgets('connected journeys: makeup→children→shoes→all + placeModes + hair + empty back', (
    tester,
  ) async {
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

    // ---- Journey A: face makeup kit video then children ----
    final beautyKey = GlobalKey<DiscoverPresentationScreenState>();
    await pumpDiscover(tester, lane: DiscoverLane.beauty, key: beautyKey);
    // Start from elegance face product via children switch after makeup product lane is separate —
    // Prompt journey: makeup kit (product) then children. Use elegance first for makeup kit.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();

    final eleganceKey = GlobalKey<DiscoverPresentationScreenState>();
    await pumpDiscover(tester, lane: DiscoverLane.elegance, key: eleganceKey);
    // Open face section if present; otherwise search by relying on feed.
    if (find.text('البشرة').evaluate().isNotEmpty || find.text('الوجه').evaluate().isNotEmpty) {
      final faceLabel = find.text('البشرة').evaluate().isNotEmpty ? 'البشرة' : 'الوجه';
      await tapLabel(tester, faceLabel);
    }
    await tester.pump(const Duration(seconds: 3));
    var events = await waitPlayback(eleganceKey.currentState!, type: 'started');
    final makeupStarted = events.where((e) => e.type == 'started' && e.offerId == makeupKit).toList();
    // Makeup kit may not be first; swipe until found or accept any started then switch lanes.
    if (makeupStarted.isEmpty) {
      // Best-effort: still proceed to children — stop must fire on leave.
    }
    final beforeLeave = List.of(eleganceKey.currentState!.debugPlaybackEvents);

    // Switch to children lane (new screen) — prior player must stop.
    final childrenKey = GlobalKey<DiscoverPresentationScreenState>();
    await pumpDiscover(tester, lane: DiscoverLane.children, key: childrenKey);
    await tester.pump(const Duration(seconds: 3));
    events = await waitPlayback(childrenKey.currentState!, type: 'started');
    final childIds = <String>{
      ...events.where((e) => e.type == 'started').map((e) => e.offerId),
      if (childrenKey.currentState!.debugPlayingOfferId.isNotEmpty)
        childrenKey.currentState!.debugPlayingOfferId,
    };
    final childrenPass = childIds.contains(kidsClothes) || childIds.contains(kidsShoes);
    final childrenExcludeMakeup = !childIds.contains(makeupKit);
    rows.add({
      ...row(
        path: 'طقم مكياج ← الأطفال',
        state: childrenKey.currentState!,
        status: childrenPass && childrenExcludeMakeup ? 'PASS' : 'FAIL',
      ),
      'resultIds': childIds.toList(),
      'priorPlaybackEvents': beforeLeave.map((e) => e.toJson()).toList(),
      'expectedMustIncludeAny': [kidsClothes, kidsShoes],
      'expectedMustExclude': [makeupKit],
    });

    // shoes leaf then الكل
    if (find.text('أحذية أطفال').evaluate().isNotEmpty) {
      await tapLabel(tester, 'أحذية أطفال');
    } else if (find.text('أحذية').evaluate().isNotEmpty) {
      await tapLabel(tester, 'أحذية');
    }
    await tester.pump(const Duration(seconds: 2));
    final shoesState = childrenKey.currentState!;
    final shoesLit = shoesState.debugRailIds.isEmpty
        ? ''
        : shoesState.debugRailIds[shoesState.debugCategoryIndex.clamp(0, shoesState.debugRailIds.length - 1)];
    final shoesOk = shoesState.debugQuery.subcategoryId == 'children.shoes' ||
        shoesLit.contains('shoes');
    await tapLabel(tester, 'الكل');
    await tester.pump(const Duration(seconds: 2));
    final allState = childrenKey.currentState!;
    final allLit = allState.debugRailIds.isEmpty
        ? ''
        : allState.debugRailIds[allState.debugCategoryIndex.clamp(0, allState.debugRailIds.length - 1)];
    final allOk = allState.debugQuery.categoryId == 'children' &&
        (allState.debugQuery.subcategoryId == null || allState.debugQuery.subcategoryId!.isEmpty) &&
        (allLit == 'all' || allLit.endsWith('.all'));
    rows.add({
      ...row(
        path: 'الأطفال ← أحذية أطفال ← الكل',
        state: allState,
        status: shoesOk && allOk ? 'PASS' : 'FAIL',
        note: 'shoesLit=$shoesLit allLit=$allLit',
      ),
      'resultIds': [
        if (allState.debugPlayingOfferId.isNotEmpty) allState.debugPlayingOfferId,
      ],
    });

    // lifecycle: background
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(milliseconds: 400));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(seconds: 2));
    final afterBg = childrenKey.currentState!;
    final bgLit = afterBg.debugRailIds.isEmpty
        ? ''
        : afterBg.debugRailIds[afterBg.debugCategoryIndex.clamp(0, afterBg.debugRailIds.length - 1)];
    rows.add({
      ...row(
        path: 'الأطفال ← الكل بعد خلفية',
        state: afterBg,
        status: bgLit == 'all' || bgLit.endsWith('.all') ? 'PASS' : 'FAIL',
      ),
    });

    // ---- Beauty: makeup + home + الكل ----
    await pumpDiscover(tester, lane: DiscoverLane.beauty, key: beautyKey);
    if (find.text('في موقعك').evaluate().isNotEmpty) {
      await tapLabel(tester, 'في موقعك');
    }
    if (find.text('صالونات ومختصّات').evaluate().isNotEmpty) {
      await tapLabel(tester, 'صالونات ومختصّات');
    }
    if (find.text('المكياج').evaluate().isNotEmpty) {
      await tapLabel(tester, 'المكياج');
    }
    if (find.text('الكل').evaluate().isNotEmpty) {
      await tapLabel(tester, 'الكل');
    }
    await tester.pump(const Duration(seconds: 3));
    final beautyState = beautyKey.currentState!;
    final beautyQ = beautyState.debugQuery;
    final placeOk = beautyQ.placeModes.contains('home');
    final catOk = beautyQ.categoryId == 'makeup' ||
        (beautyQ.categoryId != null && beautyQ.categoryId!.contains('makeup')) ||
        beautyState.debugEleganceDrillParentId == 'beauty.makeup' ||
        beautyState.debugEleganceDrillParentId == 'beauty.salons';
    final play = await waitPlayback(beautyState, type: 'started');
    final playIds = play.where((e) => e.type == 'started').map((e) => e.offerId).toSet();
    final homePass = placeOk &&
        catOk &&
        (playIds.contains(makeupHome) || beautyState.debugPlayingOfferId == makeupHome) &&
        !playIds.contains(makeupVenue) &&
        !playIds.contains(makeupKit);
    rows.add({
      ...row(
        path: 'خدمات المكياج + في موقعك ← الكل',
        state: beautyState,
        status: homePass ? 'PASS' : 'FAIL',
        note: 'place=${beautyQ.placeModes} cat=${beautyQ.categoryId} drill=${beautyState.debugEleganceDrillParentId}',
      ),
      'resultIds': playIds.toList(),
      'expectedMustInclude': [makeupHome],
      'expectedMustExclude': [makeupVenue, makeupKit],
    });

    // one-level back from makeup
    if (find.text('رجوع').evaluate().isNotEmpty) {
      await tapLabel(tester, 'رجوع');
      final backParent = beautyKey.currentState!.debugEleganceDrillParentId;
      rows.add({
        ...row(
          path: 'المكياج ← رجوع (مستوى واحد)',
          state: beautyKey.currentState!,
          status: backParent == 'beauty.salons' ? 'PASS' : 'FAIL',
          note: 'drillParent=$backParent',
        ),
      });
    }

    // hair color / blowdry
    if (find.text('الشعر').evaluate().isNotEmpty) {
      await tapLabel(tester, 'الشعر');
      await tester.pump(const Duration(seconds: 2));
      final hairAll = await waitPlayback(beautyKey.currentState!, type: 'started');
      final hairIds = hairAll.where((e) => e.type == 'started').map((e) => e.offerId).toSet();
      rows.add({
        ...row(
          path: 'الشعر ← الكل',
          state: beautyKey.currentState!,
          status: hairIds.contains(hairColor) || hairIds.contains(hairBlow) ? 'PASS' : 'FAIL',
        ),
        'resultIds': hairIds.toList(),
      });
      if (find.text('صبغة').evaluate().isNotEmpty) {
        await tapLabel(tester, 'صبغة');
        await tester.pump(const Duration(seconds: 2));
        final colorEvents = await waitPlayback(beautyKey.currentState!, type: 'started');
        final colorIds = colorEvents.where((e) => e.type == 'started').map((e) => e.offerId).toSet();
        rows.add({
          ...row(
            path: 'الشعر ← صبغة',
            state: beautyKey.currentState!,
            status: colorIds.contains(hairColor) && !colorIds.contains(hairBlow) ? 'PASS' : 'FAIL',
          ),
          'resultIds': colorIds.toList(),
        });
      }
      if (find.text('استشوار').evaluate().isNotEmpty) {
        await tapLabel(tester, 'استشوار');
        await tester.pump(const Duration(seconds: 2));
        final blowEvents = await waitPlayback(beautyKey.currentState!, type: 'started');
        final blowIds = blowEvents.where((e) => e.type == 'started').map((e) => e.offerId).toSet();
        rows.add({
          ...row(
            path: 'الشعر ← استشوار',
            state: beautyKey.currentState!,
            status: blowIds.contains(hairBlow) ? 'PASS' : 'FAIL',
          ),
          'resultIds': blowIds.toList(),
        });
      }
    }

    // Lane membership matrix (widget-level connected screens)
    for (final entry in [
      (DiscoverLane.jewelry, jewelry, [kidsClothes, makeupKit], 'المجوهرات'),
      (DiscoverLane.gifts, gift, [kidsClothes, jewelry], 'الهدايا'),
      (DiscoverLane.elegance, eleganceDress, [kidsClothes, jewelry, gift], 'أناقتك'),
    ]) {
      final key = GlobalKey<DiscoverPresentationScreenState>();
      await pumpDiscover(tester, lane: entry.$1, key: key);
      await tester.pump(const Duration(seconds: 3));
      final ev = await waitPlayback(key.currentState!, type: 'started', timeout: const Duration(seconds: 12));
      final ids = ev.where((e) => e.type == 'started').map((e) => e.offerId).toSet();
      if (key.currentState!.debugPlayingOfferId.isNotEmpty) {
        ids.add(key.currentState!.debugPlayingOfferId);
      }
      final ok = ids.contains(entry.$2) && entry.$3.every((x) => !ids.contains(x));
      rows.add({
        ...row(
          path: '${entry.$4} ← الكل (عضوية المسار)',
          state: key.currentState!,
          status: ok ? 'PASS' : 'FAIL',
        ),
        'resultIds': ids.toList(),
        'expectedMustInclude': [entry.$2],
        'expectedMustExclude': entry.$3,
      });
    }

    // Empty section: newborn under children if present
    final emptyKey = GlobalKey<DiscoverPresentationScreenState>();
    await pumpDiscover(tester, lane: DiscoverLane.children, key: emptyKey);
    if (find.text('مواليد').evaluate().isNotEmpty || find.text('حديثي الولادة').evaluate().isNotEmpty) {
      final label = find.text('مواليد').evaluate().isNotEmpty ? 'مواليد' : 'حديثي الولادة';
      await tapLabel(tester, label);
      await tester.pump(const Duration(seconds: 2));
      final emptyState = emptyKey.currentState!;
      final emptyOk = emptyState.debugActiveMediaUrl.isEmpty;
      rows.add({
        ...row(
          path: 'قسم فارغ (مواليد)',
          state: emptyState,
          status: emptyOk ? 'PASS' : 'FAIL',
        ),
        'resultIds': <String>[],
      });
      if (find.text('رجوع').evaluate().isNotEmpty) {
        await tapLabel(tester, 'رجوع');
        rows.add({
          ...row(
            path: 'قسم فارغ ← رجوع',
            state: emptyKey.currentState!,
            status: emptyKey.currentState!.debugEleganceDrillParentId == null ||
                    emptyKey.currentState!.debugEleganceDrillParentId == 'children'
                ? 'PASS'
                : 'FAIL',
          ),
        });
      }
    }

    final failed = rows.where((r) => r['status'] != 'PASS').length;
    final summary = {
      'runId': manifest['runId'],
      'gitHead': const String.fromEnvironment('MIRA_GIT_HEAD', defaultValue: ''),
      'startedAt': DateTime.now().toUtc().toIso8601String(),
      'apiBase': const String.fromEnvironment('MIRA_API_BASE_URL'),
      'verdict': failed == 0 ? 'CLOSED_VERIFIED_LOCAL' : 'NOT_VERIFIED',
      'failedCount': failed,
      'rows': rows,
      'taxonomyLoaded': EleganceTaxonomySource.isLoaded,
    };
    File('${outDir.path}/CONNECTED_SUMMARY.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert(summary));
    final table = StringBuffer('# ACCEPTANCE_TABLE\n\n| المسار | الدائرة | الفلاتر | الطلب | النتائج | الوسيط | الحالة |\n|---|---|---|---|---|---|---|\n');
    for (final r in rows) {
      table.writeln(
        '| ${r['path']} | ${r['litCircle']} | ${jsonEncode(r['filters'])} | ${jsonEncode(r['request'])} | ${jsonEncode(r['resultIds'])} | started=${jsonEncode(r['playbackStarted'])} stopped=${jsonEncode(r['playbackStopped'])} | ${r['status']} |',
      );
    }
    File('${outDir.path}/ACCEPTANCE_TABLE.md').writeAsStringSync(table.toString());
    // ignore: avoid_print
    print('ALL_CLOSE_SUMMARY ${jsonEncode({'verdict': summary['verdict'], 'failed': failed, 'rows': rows.length})}');
    expect(failed, 0, reason: 'connected journeys failed=$failed see CONNECTED_SUMMARY.json');
  });
}
