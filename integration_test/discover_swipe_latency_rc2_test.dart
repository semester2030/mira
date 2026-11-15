import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Live Discover swipe latency — separates cold open and end-of-feed from transitions.
/// Uses elegance passes (catalog ~14 playable) until 30 real page-changing transitions.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Discover live catalog: cold + 30 real transitions with feed diagnostics', (tester) async {
    final transitionSamples = <int>[];
    final phaseRows = <Map<String, Object?>>[];
    final endOfFeed = <Map<String, Object?>>[];
    final stalled = <Map<String, Object?>>[];
    final timeouts = <Map<String, Object?>>[];
    final raw = <Map<String, Object?>>[];
    final mediaSeen = <String>{};
    var realTransitions = 0;
    var attempts = 0;
    Map<String, Object?>? cold;
    var pass = 0;

    while (realTransitions < 30 && pass < 4) {
      pass += 1;
      final key = GlobalKey<DiscoverPresentationScreenState>();
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
            child: DiscoverPresentationScreen(
              key: key,
              lane: DiscoverLane.elegance,
            ),
          ),
        ),
      );
      await _settle(tester, 4000);
      final state = key.currentState;
      if (state == null) break;

      final open = await _waitFrameEvent(tester, state, since: 0, timeoutMs: 25000);
      if (cold == null && open != null) {
        cold = {...open, 'pass': pass, 'feed': _feedSnap(state)};
        // ignore: avoid_print
        print('LATENCY_COLD ${jsonEncode(cold)}');
      } else if (open != null) {
        raw.add({...open, 'kind': 'pass_open', 'pass': pass, 'phases': state.debugLastAttachPhases});
      }

      var eof = false;
      while (realTransitions < 30 && attempts < 90 && !eof) {
        attempts += 1;
        if (find.byType(PageView).evaluate().isEmpty) {
          endOfFeed.add({'attempt': attempts, 'pass': pass, 'reason': 'no_pageview'});
          break;
        }

        final before = _feedSnap(state);
        final beforeLen = state.debugPlaybackEvents.length;
        final beforeUrl = state.debugActiveMediaUrl;
        final beforePage = state.debugPageIndex;
        final beforeOffer = state.debugPlayingOfferId;

        await _flingNextOffer(tester);
        if (state.debugLoadingMore || state.debugNextCursor != null) {
          await _waitLoadMoreIdle(tester, state, timeoutMs: 10000);
        }
        await _settle(tester, 350);

        final after = _feedSnap(state);
        final pageMoved = after['page'] != beforePage;
        final offerMoved = after['offerId'] != beforeOffer;

        if (!pageMoved && !offerMoved) {
          final row = {
            'attempt': attempts,
            'pass': pass,
            'reason': state.debugNextCursor == null ? 'end_of_feed' : 'page_stuck',
            'before': before,
            'after': after,
            'loadMoreError': state.debugLoadMoreError,
          };
          if (state.debugNextCursor == null) {
            endOfFeed.add(row);
            // ignore: avoid_print
            print('LATENCY_EOF ${jsonEncode(row)}');
            eof = true;
            break;
          }
          stalled.add(row);
          // ignore: avoid_print
          print('LATENCY_STUCK ${jsonEncode(row)}');
          await _waitLoadMoreIdle(tester, state, timeoutMs: 10000);
          continue;
        }

        final ev = await _waitFrameEvent(tester, state, since: beforeLen, timeoutMs: 12000);
        final phases = Map<String, int?>.from(state.debugLastAttachPhases);
        if (ev == null) {
          final row = {
            'attempt': attempts,
            'pass': pass,
            'reason': 'no_event',
            'before': before,
            'after': after,
            'beforeUrl': beforeUrl,
            'phases': phases,
          };
          timeouts.add(row);
          // ignore: avoid_print
          print('LATENCY_NO_EVENT ${jsonEncode(row)}');
          continue;
        }

        final row = {
          ...ev,
          'attempt': attempts,
          'i': realTransitions,
          'pass': pass,
          'before': before,
          'after': after,
          'beforeUrl': beforeUrl,
          'phases': phases,
        };
        raw.add(row);
        phaseRows.add(row);
        final url = '${ev['mediaUrl'] ?? ''}';
        if (url.isNotEmpty) mediaSeen.add(url);

        if (ev['type'] == 'first_frame' && ev['positionMs'] is int) {
          transitionSamples.add(ev['positionMs'] as int);
          realTransitions += 1;
        } else if (ev['type'] == 'first_frame_timeout') {
          timeouts.add(row);
        }
        // ignore: avoid_print
        print('LATENCY_T$realTransitions ${jsonEncode(row)}');
        // Give the next-clip warm time to finish initialize while this clip is "watched".
        await _settle(tester, 1800);
      }
    }

    if (cold != null) raw.insert(0, {...cold, 'kind': 'cold'});

    transitionSamples.sort();
    int? median(List<int> s) => s.isEmpty ? null : s[s.length ~/ 2];
    int? p95(List<int> s) =>
        s.isEmpty ? null : s[min(s.length - 1, (s.length * 0.95).floor())];

    Map<String, Object?>? pickExtreme(bool slow) {
      final frames = phaseRows.where((r) => r['type'] == 'first_frame').toList();
      if (frames.isEmpty) return null;
      frames.sort((a, b) => ((a['positionMs'] as int?) ?? 0).compareTo((b['positionMs'] as int?) ?? 0));
      return slow ? frames.last : frames.first;
    }

    final out = <String, Object?>{
      'kind': 'discover_ui_live_swipe_latency_v4_warm_fix',
      'atUtc': DateTime.now().toUtc().toIso8601String(),
      'gitHint': 'warm-inflight-claim',
      'baselineGit': 'f3a7567',
      'baselineFile': 'MIRA_SWIPE_LATENCY_MiraRC2_20261115T021759Z_v3.json',
      'platform': 'ios_simulator_MiraRC2',
      'platformNoteAr':
          'إصلاح: attach يعيد استخدام warm قيد التهيئة بدل التخلص منه. الغلاف يبقى حتى first_frame.',
      'coldOpen': cold,
      'warmRootCauseAr':
          'خط الأساس v3: 28/30 cold لأن السحب أثناء التجهيز كان يتخلص من المشغّل نصف الجاهز ويفتح مسارًا باردًا.',
      'transitions': {
        'requested': 30,
        'attempts': attempts,
        'passes': pass,
        'nFirstFrame': transitionSamples.length,
        'samplesMs': transitionSamples,
        'medianMs': median(transitionSamples),
        'p95Ms': p95(transitionSamples),
        'timeouts': timeouts.length,
        'timeoutRows': timeouts,
        'endOfFeedRows': endOfFeed,
        'stalledRows': stalled,
        'warmHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 1).length,
        'parkedHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 2).length,
        'coldHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 0).length,
      },
      'extremes': {'fastest': pickExtreme(false), 'slowest': pickExtreme(true)},
      'distinctMediaUrls': mediaSeen.length,
      'mediaUrls': mediaSeen.toList(),
      'raw': raw,
      'targets': {'medianMs': 300, 'p95Ms': 700, 'warmMedianMs': 300},
      'meetsTargets':
          (median(transitionSamples) ?? 9999) <= 300 &&
          (p95(transitionSamples) ?? 9999) <= 700,
      'baselineCompare': {
        'coldMs': 3596,
        'medianMs': 2765,
        'p95Ms': 3766,
        'nFirstFrame': 30,
        'warmHits': 2,
      },
    };

    final encoded = const JsonEncoder.withIndent('  ').convert(out);
    try {
      await File('/tmp/SWIPE_LATENCY_MiraRC2_LATEST.json').writeAsString(encoded);
    } catch (_) {}
    // ignore: avoid_print
    print('LATENCY_JSON_BEGIN');
    // ignore: avoid_print
    print(encoded);
    // ignore: avoid_print
    print('LATENCY_JSON_END');
    // ignore: avoid_print
    print(jsonEncode({
      'LATENCY_SUMMARY': true,
      'coldMs': cold?['positionMs'],
      'medianMs': median(transitionSamples),
      'p95Ms': p95(transitionSamples),
      'nFirstFrame': transitionSamples.length,
      'warmHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 1).length,
      'parkedHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 2).length,
      'coldHits': phaseRows.where((r) => (r['phases'] as Map?)?['source'] == 0).length,
      'timeouts': timeouts.length,
      'endOfFeed': endOfFeed.length,
      'distinctMedia': mediaSeen.length,
      'attempts': attempts,
      'passes': pass,
    }));

    expect(transitionSamples.length, greaterThanOrEqualTo(30));
  }, timeout: const Timeout(Duration(minutes: 25)));
}

Map<String, Object?> _feedSnap(DiscoverPresentationScreenState state) => {
      'page': state.debugPageIndex,
      'slideCount': state.debugSlideCount,
      'offerId': state.debugPlayingOfferId,
      'mediaUrl': state.debugActiveMediaUrl,
      'nextCursor': state.debugNextCursor,
      'loadingMore': state.debugLoadingMore,
      'loadMoreError': state.debugLoadMoreError,
    };

Future<void> _settle(WidgetTester tester, int ms) async {
  for (var i = 0; i < (ms / 100).ceil(); i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _flingNextOffer(WidgetTester tester) async {
  final views = find.byType(PageView);
  expect(views, findsWidgets);
  await tester.fling(views.first, const Offset(0, -420), 1400);
  await _settle(tester, 450);
}

Future<void> _waitLoadMoreIdle(
  WidgetTester tester,
  DiscoverPresentationScreenState state, {
  required int timeoutMs,
}) async {
  final steps = (timeoutMs / 200).ceil();
  for (var i = 0; i < steps; i++) {
    await tester.pump(const Duration(milliseconds: 200));
    if (!state.debugLoadingMore) return;
  }
}

Future<Map<String, Object?>?> _waitFrameEvent(
  WidgetTester tester,
  DiscoverPresentationScreenState state, {
  required int since,
  required int timeoutMs,
}) async {
  final steps = (timeoutMs / 200).ceil();
  for (var i = 0; i < steps; i++) {
    await tester.pump(const Duration(milliseconds: 200));
    final added = state.debugPlaybackEvents.skip(since).toList();
    for (final e in added.reversed) {
      if (e.type == 'first_frame' || e.type == 'first_frame_timeout') {
        return {
          'type': e.type,
          'positionMs': e.positionMs,
          'offerId': e.offerId,
          'mediaUrl': e.mediaUrl,
        };
      }
    }
  }
  return null;
}
