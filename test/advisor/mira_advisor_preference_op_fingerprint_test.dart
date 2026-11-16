import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/advisor/domain/services/mira_advisor_memory_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('preferenceOpFingerprint', () {
    test('set city and clear city are different fingerprints', () {
      const session = 'sess-1';
      final setId = MiraAdvisorMemoryStore.preferenceOpFingerprint(
        op: 'set',
        sessionId: session,
        accountUid: 'u1',
        goalAr: 'الرياض',
      );
      final clearId = MiraAdvisorMemoryStore.preferenceOpFingerprint(
        op: 'clear',
        sessionId: session,
        accountUid: 'u1',
        goalAr: null,
      );
      expect(setId, isNot(equals(clearId)));
      expect(setId, contains('set'));
      expect(clearId, contains('clear'));
    });

    test('same command same fingerprint; different content differs', () {
      final a = MiraAdvisorMemoryStore.preferenceOpFingerprint(
        op: 'set',
        sessionId: 's',
        accountUid: 'u',
        goalAr: 'تذكّري الرياض',
      );
      final b = MiraAdvisorMemoryStore.preferenceOpFingerprint(
        op: 'set',
        sessionId: 's',
        accountUid: 'u',
        goalAr: 'تذكّري الرياض',
      );
      final c = MiraAdvisorMemoryStore.preferenceOpFingerprint(
        op: 'set',
        sessionId: 's',
        accountUid: 'u',
        goalAr: 'تذكّري جدة',
      );
      expect(a, equals(b));
      expect(a, isNot(equals(c)));
    });
  });
}
