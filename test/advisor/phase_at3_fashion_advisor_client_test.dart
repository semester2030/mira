import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/core/config/mira_features.dart';
import 'package:mirra/features/advisor/domain/entities/advisor_fashion_context.dart';
import 'package:mirra/features/advisor/domain/entities/advisor_response.dart';
import 'package:mirra/features/advisor/domain/mappers/advisor_fashion_context_mapper.dart';
import 'package:mirra/features/advisor/domain/services/fashion_advisor_route_decision.dart';
import 'package:mirra/features/advisor/domain/services/fashion_conversation_context_parser.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';

OutfitAnalysis _redYellowWedding({
  String formality = 'شبه رسمي',
  String gate = 'proceed',
  List<String> shoeColors = const [],
  List<String> accessoryColors = const [],
}) {
  return OutfitAnalysis(
    occasion: MiraOccasion.wedding,
    mode: OutfitAnalysisMode.smart,
    clothingType: 'بلوزة وتنورة',
    styleType: 'statement',
    dominantColors: const ['أحمر', 'أصفر'],
    compatibilityScore: 72,
    recommendedColors: const [],
    rejectedColors: const [],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: 'test',
    confidence: 70,
    upperBodyColors: const ['أحمر'],
    lowerBodyColors: const ['أصفر'],
    shoeColors: shoeColors,
    accessoryColors: accessoryColors,
    formalityLevel: formality,
    analysisGate: gate,
    detectedPieces: const ['بلوزة', 'تنورة'],
  );
}

void main() {
  group('AT-3 feature flag', () {
    test('fashionAdvisorV1 defaults false', () {
      expect(MiraFeatures.fashionAdvisorV1, isFalse);
    });
  });

  group('AT-3 routing', () {
    test('skin-only stays on MCE', () {
      final r = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: true,
        outfitContextPresent: false,
        fashionConversationSticky: false,
        isSkinOnlyFocus: true,
        isAtelierFocus: false,
      );
      expect(r, FashionAdvisorClientRoute.mceConsultation);
    });

    test('atelier stays on MCE when not sticky fashion', () {
      final r = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: true,
        outfitContextPresent: true,
        fashionConversationSticky: false,
        isSkinOnlyFocus: false,
        isAtelierFocus: true,
      );
      expect(r, FashionAdvisorClientRoute.mceConsultation);
    });

    test('outfit + flag OFF → fashionUnavailable (no MCE prescription)', () {
      final r = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: false,
        outfitContextPresent: true,
        fashionConversationSticky: false,
        isSkinOnlyFocus: false,
        isAtelierFocus: false,
      );
      expect(r, FashionAdvisorClientRoute.fashionUnavailable);
    });

    test('outfit + flag ON → advisorFashionChat', () {
      final r = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: true,
        outfitContextPresent: true,
        fashionConversationSticky: false,
        isSkinOnlyFocus: false,
        isAtelierFocus: false,
      );
      expect(r, FashionAdvisorClientRoute.advisorFashionChat);
    });

    test('sticky fashion follow-up stays on Advisor even without re-detect', () {
      final r = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: true,
        outfitContextPresent: true,
        fashionConversationSticky: true,
        isSkinOnlyFocus: false,
        isAtelierFocus: false,
      );
      expect(r, FashionAdvisorClientRoute.advisorFashionChat);
    });
  });

  group('AT-3 fashion context mapper', () {
    test('red/yellow/wedding maps garments + occasion + UNKNOWN accessories', () {
      final ctx = AdvisorFashionContextMapper.fromOutfitAnalysis(
        _redYellowWedding(),
        outfitAnalysisId: 'outfit:ry_wedding',
      );
      expect(ctx.occasion, 'wedding');
      expect(ctx.outfitId, 'outfit:ry_wedding');
      expect(ctx.garments.length, greaterThanOrEqualTo(2));
      expect(ctx.garments.first.colors, contains('أحمر'));
      expect(ctx.garments[1].colors, contains('أصفر'));
      expect(
        ctx.accessories.any((a) => a.category == 'shoes' && a.presence == 'UNKNOWN'),
        isTrue,
      );
      expect(ctx.evidenceRefs, isNotEmpty);
      expect(ctx.culturalContext, isNull);
    });

    test('shoes PRESENT when shoe colors known', () {
      final ctx = AdvisorFashionContextMapper.fromOutfitAnalysis(
        _redYellowWedding(shoeColors: const ['أسود']),
      );
      final shoes =
          ctx.accessories.firstWhere((a) => a.category == 'shoes');
      expect(shoes.presence, 'PRESENT');
      expect(shoes.colors, contains('أسود'));
    });

    test('UNKNOWN ≠ ABSENT — jewelry stays UNKNOWN', () {
      final ctx =
          AdvisorFashionContextMapper.fromOutfitAnalysis(_redYellowWedding());
      final jewelry =
          ctx.accessories.firstWhere((a) => a.category == 'jewelry');
      expect(jewelry.presence, 'UNKNOWN');
    });

    test('stale gate sets evidenceStale', () {
      final ctx = AdvisorFashionContextMapper.fromOutfitAnalysis(
        _redYellowWedding(gate: 'degraded'),
      );
      expect(ctx.evidenceStale, isTrue);
    });

    test('no silhouette/material fabricated', () {
      final ctx =
          AdvisorFashionContextMapper.fromOutfitAnalysis(_redYellowWedding());
      for (final g in ctx.garments) {
        expect(g.silhouette, isNull);
        expect(g.material, isNull);
      }
    });

    test('JSON has no authority fields', () {
      final ctx = AdvisorFashionContextMapper.fromOutfitAnalysis(
        _redYellowWedding(),
        explicitCulturalContext: 'saudi_wedding',
        culturalContextExplicit: true,
        extraPreferenceTokens: const ['bold'],
      );
      final json = ctx.toJson();
      for (final key in AdvisorFashionContext.forbiddenAuthorityKeys) {
        expect(json.containsKey(key), isFalse, reason: key);
      }
      expect(json['culturalContext'], 'saudi_wedding');
      expect(json['culturalContextExplicit'], isTrue);
      expect(json['preferenceTokens'], contains('bold'));
      expect(json.containsKey('sourceType'), isFalse);
    });
  });

  group('AT-3 conversation context parser', () {
    test('bold preference from Arabic', () {
      final tokens = FashionConversationContextParser.preferenceTokensFromMessage(
        'أنا أحب الإطلالات الجريئة',
      );
      expect(tokens, contains('bold'));
      expect(
        FashionConversationContextParser.styleGoalFromMessage(
          'أنا أحب الإطلالات الجريئة',
        ),
        'statement look',
      );
    });

    test('explicit saudi wedding cultural context', () {
      expect(
        FashionConversationContextParser.explicitCulturalContext('زواج سعودي'),
        'saudi_wedding',
      );
    });

    test('Arabic locale alone does NOT create culture', () {
      expect(
        FashionConversationContextParser.culturalFromLocaleAlone('ar'),
        isNull,
      );
      expect(
        FashionConversationContextParser.culturalFromLocaleAlone('ar_SA'),
        isNull,
      );
    });

    test('dress code from clarification message', () {
      expect(
        FashionConversationContextParser.dressCodeFromMessage(
          'الزواج مساء ورسمي',
        ),
        'evening_formal',
      );
    });
  });

  group('AT-3 AdvisorResponse decode', () {
    test('decodes public fields + additive unknown tolerance', () {
      final r = AdvisorResponse.fromJson({
        'answer': 'إذا كان هدفك إطلالة أكثر هدوءًا…',
        'suggestedQuestions': ['ليش؟', 'بديل؟'],
        'confidence': 'medium',
        'intent': 'fashion',
        'blocked': false,
        'disclaimerAr': 'تنويه',
        'envelopeId': 'should_be_ignored_by_client',
        'traceId': 'should_be_ignored',
      });
      expect(r.answer, contains('هدوء'));
      expect(r.suggestedQuestions.length, 2);
      expect(r.disclaimerAr, 'تنويه');
      expect(r.blocked, isFalse);
    });
  });

  group('AT-3 double-path invariant (logical)', () {
    test('Advisor and MCE routes are mutually exclusive', () {
      const fashion = FashionAdvisorClientRoute.advisorFashionChat;
      const mce = FashionAdvisorClientRoute.mceConsultation;
      expect(fashion == mce, isFalse);
      // Product rule: one turn chooses exactly one route.
      final chosen = FashionAdvisorRouteDecision.decide(
        fashionAdvisorV1Enabled: true,
        outfitContextPresent: true,
        fashionConversationSticky: false,
        isSkinOnlyFocus: false,
        isAtelierFocus: false,
      );
      expect(chosen, FashionAdvisorClientRoute.advisorFashionChat);
      expect(chosen == FashionAdvisorClientRoute.mceConsultation, isFalse);
    });
  });
}
