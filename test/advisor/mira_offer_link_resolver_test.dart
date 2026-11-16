import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/advisor/domain/entities/consultant_discovery_offer.dart';
import 'package:mirra/features/advisor/domain/services/mira_advisor_memory_store.dart';
import 'package:mirra/features/advisor/domain/services/mira_discovery_outcome.dart';
import 'package:mirra/features/advisor/domain/services/mira_offer_link_resolver.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await MiraAdvisorMemoryStore.bindAccount('user-a');
    await MiraAdvisorMemoryStore.bindSession('session-a');
    await MiraAdvisorMemoryStore.setEnabled(true);
    await MiraAdvisorMemoryStore.rememberTurnOffers([
      (id: 'p1', kind: 'product', titleAr: 'مرطب أ', liveStatus: 'published'),
      (id: 'p2', kind: 'product', titleAr: 'مرطب ب', liveStatus: 'published'),
      (id: 'p3', kind: 'product', titleAr: 'مرطب ج', liveStatus: 'published'),
    ]);
  });

  test('رابط الثاني opens second offer', () async {
    final d = await MiraOfferLinkResolver.resolve('عطيني رابط الثاني');
    expect(d.kind, MiraOfferLinkKind.open);
    expect(d.offerId, 'p2');
  });

  test('عطيني الرابط with multiple offers clarifies', () async {
    final d = await MiraOfferLinkResolver.resolve('عطيني الرابط');
    expect(d.kind, MiraOfferLinkKind.clarify);
    expect(d.clarifyAr, contains('الثاني'));
  });

  test('الثاني with a single offer clarifies — never opens the first', () async {
    await MiraAdvisorMemoryStore.rememberTurnOffers([
      (id: 'only', kind: 'product', titleAr: 'عرض واحد', liveStatus: 'published'),
    ]);
    final d = await MiraOfferLinkResolver.resolve('عطيني رابط الثاني');
    expect(d.kind, MiraOfferLinkKind.clarify);
    expect(d.offerId, isNull);
    expect(d.clarifyAr, contains('خيار واحد'));
  });

  test('bare الثاني after clarify opens the intended offer', () async {
    final clarify = await MiraOfferLinkResolver.resolve('عطيني الرابط');
    expect(clarify.kind, MiraOfferLinkKind.clarify);
    expect(await MiraAdvisorMemoryStore.isAwaitingLinkOrdinal(), isTrue);
    final d = await MiraOfferLinkResolver.resolve('الثاني');
    expect(d.kind, MiraOfferLinkKind.open);
    expect(d.offerId, 'p2');
  });

  test('الثاني ليش أغلى؟ is comparison not an open command', () async {
    await MiraOfferLinkResolver.resolve('عطيني الرابط');
    expect(await MiraOfferLinkResolver.isOfferLinkTurn('الثاني ليش أغلى؟'), isFalse);
    final d = await MiraOfferLinkResolver.resolve('الثاني ليش أغلى؟');
    expect(d.kind, MiraOfferLinkKind.none);
  });

  test('memory is opt-in by default', () async {
    SharedPreferences.setMockInitialValues({});
    await MiraAdvisorMemoryStore.bindAccount('fresh');
    expect(await MiraAdvisorMemoryStore.isEnabled(), isFalse);
    expect(await MiraAdvisorMemoryStore.hasExplicitConsentChoice(), isFalse);
    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage('أسكن في الرياض');
    expect(await MiraAdvisorMemoryStore.city(), isNull);
    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage(
      'فعّلي التخصيص وأسكن في الرياض',
    );
    expect(await MiraAdvisorMemoryStore.isEnabled(), isTrue);
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');
  });

  test('forget city clears local and flags stale server goal', () async {
    await MiraAdvisorMemoryStore.saveCity('جدة');
    expect(await MiraAdvisorMemoryStore.city(), 'جدة');
    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage('انسِي مدينتي');
    expect(await MiraAdvisorMemoryStore.city(), isNull);
    final brief = await MiraAdvisorMemoryStore.preferenceBriefAr();
    expect(brief, isNull);
    expect(
      MiraAdvisorMemoryStore.serverGoalStillCitesCity(
        'تفضيلات محفوظة بموافقة العميلة: المدينة: جدة',
        await MiraAdvisorMemoryStore.city(),
      ),
      isTrue,
    );
  });

  test('account switch isolates prefs, consent, and offers', () async {
    await MiraAdvisorMemoryStore.saveCity('الرياض');
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');
    expect((await MiraAdvisorMemoryStore.lastTurnOffers()).length, 3);

    await MiraAdvisorMemoryStore.bindAccount('user-b');
    await MiraAdvisorMemoryStore.bindSession('session-b');
    expect(await MiraAdvisorMemoryStore.isEnabled(), isFalse);
    expect(await MiraAdvisorMemoryStore.city(), isNull);
    expect(await MiraAdvisorMemoryStore.lastTurnOffers(), isEmpty);

    await MiraAdvisorMemoryStore.bindAccount('user-a');
    await MiraAdvisorMemoryStore.bindSession('session-a');
    expect(await MiraAdvisorMemoryStore.isEnabled(), isTrue);
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');
    expect((await MiraAdvisorMemoryStore.lastTurnOffers()).length, 3);
  });

  test('offers are scoped per session under the same account', () async {
    await MiraAdvisorMemoryStore.bindSession('session-other');
    expect(await MiraAdvisorMemoryStore.lastTurnOffers(), isEmpty);
    await MiraAdvisorMemoryStore.rememberTurnOffers([
      (id: 's2', kind: 'service', titleAr: 'جلسة', liveStatus: 'published'),
    ]);
    expect((await MiraAdvisorMemoryStore.lastTurnOffers()).single.id, 's2');

    await MiraAdvisorMemoryStore.bindSession('session-a');
    expect((await MiraAdvisorMemoryStore.lastTurnOffers()).length, 3);
  });

  test('occasion city is not saved as permanent residence', () async {
    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage(
      'عندي مناسبة في جدة الأسبوع الجاي',
    );
    expect(await MiraAdvisorMemoryStore.city(), isNull);

    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage(
      'أسكن في الرياض',
    );
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');

    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage(
      'مدينتي جدة مو الرياض',
    );
    expect(await MiraAdvisorMemoryStore.city(), 'جدة');
  });

  test('published offer without price shows غير مذكور', () {
    const offer = ConsultantDiscoveryOffer(
      kind: 'product',
      id: 'p1',
      titleAr: 'مرطب الندى',
      action: 'buy',
      openPath: '/p/p1',
    );
    expect(offer.catalogPriceLabelAr, 'غير مذكور');
  });

  test('card keeps hallalas without rounding 49.99', () {
    const offer = ConsultantDiscoveryOffer(
      kind: 'product',
      id: 'p2',
      titleAr: 'مرطب الندى',
      action: 'buy',
      openPath: '/p/p2',
      priceSar: 49.99,
    );
    expect(offer.catalogPriceLabelAr, '49.99 ريال');
    expect(offer.catalogPriceLabelAr, isNot(contains('50')));
  });

  test('no-match is distinct from search-failed', () {
    expect(
      MiraDiscoveryOutcomeCopy.classify(searchFailed: false, offerCount: 0),
      MiraDiscoveryOutcome.noMatch,
    );
    expect(
      MiraDiscoveryOutcomeCopy.classify(searchFailed: true, offerCount: 0),
      MiraDiscoveryOutcome.searchFailed,
    );
    expect(
      MiraDiscoveryOutcomeCopy.messageAr(MiraDiscoveryOutcome.noMatch),
      contains('لم نجد مطابقًا'),
    );
    expect(
      MiraDiscoveryOutcomeCopy.messageAr(MiraDiscoveryOutcome.searchFailed),
      contains('تعذّر البحث'),
    );
  });

  test('forget clears prefs', () async {
    await MiraAdvisorMemoryStore.saveHabitBudgetSar(150);
    await MiraAdvisorMemoryStore.forgetAll();
    expect(await MiraAdvisorMemoryStore.isEnabled(), isFalse);
    expect(await MiraAdvisorMemoryStore.habitBudgetSar(), isNull);
  });

  test('offline forget queues explicit clear op — empty is not “no op”', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-offline');
    await MiraAdvisorMemoryStore.bindSession('session-forget');
    await MiraAdvisorMemoryStore.saveCity('الرياض');
    await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage('انسِي مدينتي');
    expect(await MiraAdvisorMemoryStore.city(), isNull);

    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-forget',
      opId: 'op-forget-city-1',
      accountUid: 'user-offline',
    );
    final pending = await MiraAdvisorMemoryStore.pendingPreferenceOp();
    expect(pending, isNotNull);
    expect(pending!['op'], 'clear');
    expect(pending['sessionId'], 'session-forget');
    expect(pending['accountUid'], 'user-offline');
    expect(pending['opId'], 'op-forget-city-1');
    // Empty goal must not wipe the queued clear.
    expect(pending['goalAr'], isNull);
  });

  test('session A clear and session B set coexist until each is acked', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-multi');
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-a',
      opId: 'op-a-clear',
      accountUid: 'user-multi',
    );
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'set',
      sessionId: 'session-b',
      opId: 'op-b-set',
      accountUid: 'user-multi',
      goalAr: 'تفضيلات محفوظة بموافقة العميلة: المدينة: جدة',
    );
    final ops = await MiraAdvisorMemoryStore.pendingPreferenceOps();
    expect(ops.length, 2);
    expect(ops.map((e) => e['sessionId']), containsAll(['session-a', 'session-b']));
    await MiraAdvisorMemoryStore.acknowledgePendingPreferenceOp('op-a-clear');
    final after = await MiraAdvisorMemoryStore.pendingPreferenceOps();
    expect(after.length, 1);
    expect(after.single['opId'], 'op-b-set');
  });

  test('re-queue same session keeps same opId for retry', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-retry');
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-a',
      opId: 'op-stable-1',
      accountUid: 'user-retry',
    );
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-a',
      opId: 'op-stable-1',
      accountUid: 'user-retry',
    );
    final ops = await MiraAdvisorMemoryStore.pendingPreferenceOps();
    expect(ops.where((e) => e['sessionId'] == 'session-a').length, 1);
    expect(ops.singleWhere((e) => e['sessionId'] == 'session-a')['opId'], 'op-stable-1');
  });

  test('set then clear on same session are different commands — both pending', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-city');
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'set',
      sessionId: 'session-city',
      opId: 'op-set-riyadh',
      accountUid: 'user-city',
      goalAr: 'تفضيلات محفوظة بموافقة العميلة: المدينة: الرياض',
    );
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-city',
      opId: 'op-clear-city',
      accountUid: 'user-city',
    );
    final ops = await MiraAdvisorMemoryStore.pendingPreferenceOps();
    expect(ops.length, 2);
    expect(ops.map((e) => e['opId']), containsAll(['op-set-riyadh', 'op-clear-city']));
    expect(ops.map((e) => e['fingerprint']).toSet().length, 2);
  });

  test('late ack of set does not erase pending clear (forget wins)', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-late');
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'set',
      sessionId: 'session-late',
      opId: 'op-set-late',
      accountUid: 'user-late',
      goalAr: 'تفضيلات محفوظة بموافقة العميلة: المدينة: الرياض',
    );
    await MiraAdvisorMemoryStore.queuePendingPreferenceOp(
      op: 'clear',
      sessionId: 'session-late',
      opId: 'op-clear-late',
      accountUid: 'user-late',
    );
    // Delayed success for the first command must not wipe the forget.
    await MiraAdvisorMemoryStore.acknowledgePendingPreferenceOp('op-set-late');
    final after = await MiraAdvisorMemoryStore.pendingPreferenceOps();
    expect(after.length, 1);
    expect(after.single['opId'], 'op-clear-late');
    expect(after.single['op'], 'clear');
  });

  test('withdrawn offer does not open buy/book link', () async {
    await MiraAdvisorMemoryStore.rememberTurnOffers([
      (id: 'p1', kind: 'product', titleAr: 'مرطب أ', liveStatus: 'published'),
      (id: 'gone', kind: 'product', titleAr: 'مسحوب', liveStatus: 'withdrawn'),
    ]);
    final d = await MiraOfferLinkResolver.resolve('عطيني رابط الثاني');
    expect(d.kind, MiraOfferLinkKind.clarify);
    expect(d.clarifyAr, contains('منشور'));
    expect(d.offerId, isNull);
  });

  test('pending transcript keeps session id for single replay', () async {
    await MiraAdvisorMemoryStore.bindAccount('user-a');
    await MiraAdvisorMemoryStore.enqueuePendingTranscript(
      sessionId: 'session-link',
      userContentAr: 'عطيني رابط الثاني',
      assistantContentAr: 'فتح عرض',
      clientMessageId: 'c-link-1',
    );
    // Same clientMessageId replaces — once only.
    await MiraAdvisorMemoryStore.enqueuePendingTranscript(
      sessionId: 'session-link',
      userContentAr: 'عطيني رابط الثاني',
      assistantContentAr: 'فتح عرض',
      clientMessageId: 'c-link-1',
    );
    final rows = await MiraAdvisorMemoryStore.pendingTranscripts();
    expect(rows.length, 1);
    expect(rows.single['sessionId'], 'session-link');
    expect(rows.single['clientMessageId'], 'c-link-1');
  });
}
