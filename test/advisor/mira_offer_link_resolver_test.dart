import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/advisor/domain/services/mira_advisor_memory_store.dart';
import 'package:mirra/features/advisor/domain/services/mira_offer_link_resolver.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await MiraAdvisorMemoryStore.bindAccount('user-a');
    await MiraAdvisorMemoryStore.rememberTurnOffers([
      (id: 'p1', kind: 'product', titleAr: 'مرطب أ'),
      (id: 'p2', kind: 'product', titleAr: 'مرطب ب'),
      (id: 'p3', kind: 'product', titleAr: 'مرطب ج'),
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

  test('account switch does not read other prefs', () async {
    await MiraAdvisorMemoryStore.saveCity('الرياض');
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');
    await MiraAdvisorMemoryStore.bindAccount('user-b');
    expect(await MiraAdvisorMemoryStore.city(), isNull);
    await MiraAdvisorMemoryStore.bindAccount('user-a');
    expect(await MiraAdvisorMemoryStore.city(), 'الرياض');
  });

  test('forget clears prefs', () async {
    await MiraAdvisorMemoryStore.saveHabitBudgetSar(150);
    await MiraAdvisorMemoryStore.forgetAll();
    expect(await MiraAdvisorMemoryStore.isEnabled(), isFalse);
    expect(await MiraAdvisorMemoryStore.habitBudgetSar(), isNull);
  });
}
