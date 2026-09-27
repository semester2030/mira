import 'package:flutter_test/flutter_test.dart';

import 'package:mirra/core/json/json_as_string.dart';
import 'package:mirra/features/advisor/domain/entities/advisor_response.dart';
import 'package:mirra/features/consultation/domain/entities/consultation_entities.dart';

void main() {
  group('double → String? runtime defect regression', () {
    test('AdvisorResponse accepts numeric confidence without cast crash', () {
      final r = AdvisorResponse.fromJson({
        'answer': 'نصيحة عامة',
        'suggestedQuestions': <dynamic>[],
        'confidence': 0.82,
        'intent': 'skin',
        'blocked': false,
      });
      expect(r.confidence, 'high');
      expect(r.answer, 'نصيحة عامة');
    });

    test('AdvisorResponse accepts 0–100 confidence scores', () {
      final r = AdvisorResponse.fromJson({
        'answer': 'ok',
        'suggestedQuestions': <dynamic>[],
        'confidence': 40,
        'intent': 'skin',
      });
      expect(r.confidence, 'low');
    });

    test('ConsultationMessage citedFacts tolerate numeric valueAr', () {
      final m = ConsultationMessage.fromJson({
        'id': 'm1',
        'role': 'assistant',
        'contentAr': 'الترطيب جيد نسبياً',
        'blocked': false,
        'createdAt': '2026-09-09T12:00:00.000Z',
        'confidence': 0.6,
        'intent': 'skin',
        'citedFacts': [
          {
            'id': 'hydration',
            'labelAr': 'الترطيب',
            'valueAr': 72.5,
          },
        ],
      });
      expect(m.confidence, 'medium');
      expect(m.citedFacts.single.valueAr, '72.5');
    });

    test('JsonAsString.confidenceLabel preserves enum strings', () {
      expect(JsonAsString.confidenceLabel('medium'), 'medium');
      expect(JsonAsString.optional(null), isNull);
      expect(JsonAsString.required(91), '91');
    });
  });
}
