import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

void main() {
  test('stored recommendations are not shown as the current tips', () {
    const oldBpo = 'للحبوب الخفيفة: نياسيناميد أو BPO بتركيز منخفض بعد استشارة.';
    const oldRetinoid = 'واقي الشمس يوميًا أساسي؛ ريتينويد ليلي يساعد على الخطوط عند التحمل.';
    final report = SkinReport(
      skinType: 'مختلطة',
      score: 70,
      hydration: 80,
      oiliness: 40,
      pores: 1,
      wrinkles: 3,
      spots: 1,
      acne: 3,
      redness: 1,
      recommendations: const [oldBpo, oldRetinoid],
      advice: 'نصيحة محفوظة',
    );

    final built = LocalMiraReportBuilder.fromSkinReport(report);
    final tips = built.tipsAr.join('\n');

    expect(report.recommendations.first, oldBpo);
    expect(report.wrinkles, 3);
    expect(report.acne, 3);
    expect(report.hydration, 80);
    expect(report.oiliness, 40);
    expect(tips.contains('BPO'), isFalse);
    expect(tips.contains('ريتينويد'), isFalse);
    expect(tips.contains('تنظيف لطيف'), isTrue);
    expect(tips.isNotEmpty, isTrue);
  });

  test('a report without recommendations still returns useful tips', () {
    final report = SkinReport(
      skinType: 'عادية',
      score: 80,
      hydration: 70,
      oiliness: 40,
      pores: 1,
      wrinkles: 1,
      spots: 1,
      recommendations: const [],
      advice: '',
    );
    final tips = LocalMiraReportBuilder.currentTipsFor(report);
    expect(tips, isNotEmpty);
    expect(tips.join().contains('BPO'), isFalse);
  });

  test('stored report json refreshes routine, plan, and concern text', () {
    final source = <String, dynamic>{
      'overallBeautyScore': 70,
      'headlineAr': 'مقشر BHA خفيف',
      'summaryAdviceAr': 'استخدمي BPO موضعيًا',
      'mainConcerns': [
        {
          'id': 'pore',
          'titleAr': 'المسام',
          'narrativeAr': 'المسام بارزة — مقشر BHA خفيف 1–2 مرات أسبوعياً قد يساعد.',
          'severity': 'noticeable',
        },
      ],
      'dailyRoutine': {
        'evening': [
          {
            'nameAr': 'مقشر BHA خفيف',
            'nameEn': 'Light BHA Exfoliant',
            'stepAr': '2–3 مرات أسبوعياً — مساءً',
          },
        ],
      },
      'weeklyPlan': {
        'days': [
          {'stepsAr': ['BHA خفيف — مساءً فقط']},
        ],
      },
      'tipsAr': ['استخدمي BPO موضعيًا على البثور.'],
    };
    final shown = MiraBeautyReportMapper.fromJson(source);
    final shownText = [
      ...shown.mainConcerns.map((item) => item.narrativeAr),
      ...shown.dailyRoutine.morning.map((item) => '${item.nameAr} ${item.nameEn} ${item.stepAr}'),
      ...shown.dailyRoutine.evening.map((item) => '${item.nameAr} ${item.nameEn} ${item.stepAr}'),
      ...shown.weeklyPlan.days.expand((day) => day.stepsAr),
      shown.summaryAdviceAr,
      shown.headlineAr,
      ...shown.tipsAr,
    ].join('\n');
    expect(shown.overallBeautyScore, 70);
    expect(shown.mainConcerns.single.severity, 'noticeable');
    expect(shownText.contains('BHA'), isFalse);
    expect(shownText.contains('BPO'), isFalse);
    expect(shownText.contains('Light BHA'), isFalse);
    expect(source['tipsAr'], ['استخدمي BPO موضعيًا على البثور.']);
    expect((source['dailyRoutine'] as Map)['evening'], isNotEmpty);

    final sparse = MiraBeautyReportMapper.fromJson({'overallBeautyScore': 61, 'mainConcerns': []});
    expect(sparse.overallBeautyScore, 61);
    expect(sparse.tipsAr, isNotEmpty);
    expect(sparse.dailyRoutine.morning, isNotEmpty);
  });

  test('hydration 64 is kept and does not add a serum from a severity band', () {
    final source = <String, dynamic>{
      'overallBeautyScore': 70,
      'mainConcerns': [
        {
          'id': 'moisture',
          'titleAr': 'الترطيب',
          'narrativeAr': 'البشرة تحتاج ترطيباً أوضح',
          'severity': 'moderate',
        },
      ],
      'dailyRoutine': {
        'morning': [
          {'id': 'cleanser_am', 'nameAr': 'غسول لطيف', 'nameEn': 'Gentle Cleanser', 'stepAr': 'صباحاً'},
        ],
      },
      'faceHealthMap': {
        'concernOverlays': [
          {'concernId': 'moisture', 'globalScore': 64, 'severity': 'moderate'},
        ],
      },
    };
    final shown = MiraBeautyReportMapper.fromJson(Map<String, dynamic>.from(source));
    final again = LocalMiraReportBuilder.presentStored(shown);
    expect(shown.overallBeautyScore, 70);
    expect(shown.faceHealthMap.concernOverlays.single.globalScore, 64);
    expect(shown.dailyRoutine.morning.any((step) => step.id == 'serum_am'), isFalse);
    expect(again.dailyRoutine.morning.map((step) => step.id).join(','), shown.dailyRoutine.morning.map((step) => step.id).join(','));
    expect((source['faceHealthMap'] as Map)['concernOverlays'], isNotEmpty);
  });
}
