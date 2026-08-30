/**
 * FK-3 — Deterministic mock/test LLM provider.
 * Never enable silently in production (orchestrator requires explicit mock injection).
 */
import {
  type FashionAdviceCandidateDraft,
} from '../advice/advice-candidate';
import { FashionAdviceType } from '../contracts/advice-types';
import { KnowledgeConfidence } from '../contracts/confidence';
import { ConflictState } from '../contracts/conflicts';
import { KnowledgeType } from '../contracts/knowledge-types';
import { SubjectivityLevel } from '../contracts/subjectivity';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../versioning/release';
import type { FashionKnowledgeLlmPort, FashionLlmProviderResult } from './provider-port';
import type { FashionLlmKnowledgeRequest } from './request-contract';

export type MockLlmScenario =
  | 'valid'
  | 'malformed'
  | 'false_provenance'
  | 'unsafe_judgment'
  | 'clarification'
  | 'preference_conflict'
  | 'provider_failure'
  | 'attractiveness'
  | 'medical'
  | 'invented_occasion'
  | 'accessories_unknown'
  | 'accessories_known'
  | 'absolute_accessory'
  | 'gender_stereotype'
  | 'brand_sku'
  | 'form_volume_bold'
  | 'form_volume_minimal'
  | 'form_texture_evening'
  | 'form_body_slimming'
  | 'form_body_shape'
  | 'cultural_generic_wedding'
  | 'cultural_explicit_saudi_bold'
  | 'cultural_stereotype'
  | 'cultural_religious_ruling'
  | 'cultural_authority_claim';

export class MockFashionKnowledgeLlmProvider implements FashionKnowledgeLlmPort {
  readonly providerId = 'mock-fashion-knowledge-llm';

  constructor(
    private readonly scenario: MockLlmScenario = 'valid',
    private readonly failTimesBeforeOk = 0,
  ) {}

  private calls = 0;

  async generateStructuredDraft(input: {
    readonly request: FashionLlmKnowledgeRequest;
  }): Promise<FashionLlmProviderResult> {
    this.calls += 1;
    const { request } = input;

    if (this.scenario === 'provider_failure') {
      return {
        status: 'failed',
        errorCode: 'transient_provider_error',
        errorMessage: 'Mock provider failure',
        providerAuditId: 'mock_fail',
        latencyMs: 1,
      };
    }

    if (this.scenario === 'malformed') {
      if (this.calls <= this.failTimesBeforeOk) {
        return {
          status: 'malformed',
          rawText: '{not-json',
          errorCode: 'malformed_json',
          errorMessage: 'Malformed JSON',
          providerAuditId: 'mock_malformed',
        };
      }
    }

    if (this.scenario === 'false_provenance') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          rationale: 'According to Vogue Styling Guide 2025 this must change',
          suggestionText: 'Source: Vogue Styling Guide 2025 — replace yellow',
        }),
        providerAuditId: 'mock_false_src',
        latencyMs: 2,
      };
    }

    if (this.scenario === 'unsafe_judgment' || this.scenario === 'attractiveness') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          rationale: 'This skirt makes the user look slimmer and more attractive',
          suggestionText: 'Change skirt to look more beautiful',
        }),
        providerAuditId: 'mock_unsafe',
      };
    }

    if (this.scenario === 'medical') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          rationale: 'This outfit treats a medical condition of the skin',
          suggestionText: 'Wear cotton for medical treatment',
        }),
        providerAuditId: 'mock_medical',
      };
    }

    if (this.scenario === 'invented_occasion') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          occasionContext: ['wedding'],
          occasionDependency: true,
          adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
        }),
        providerAuditId: 'mock_invented_occ',
      };
    }

    if (this.scenario === 'clarification') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          adviceType: FashionAdviceType.CLARIFICATION_REQUIRED,
          occasionDependency: true,
          clarificationNeeds: ['NEED_OCCASION'],
          assumptions: ['occasion not fully specified'],
          suggestionText: 'Need occasion before assessing suitability',
        }),
        providerAuditId: 'mock_clarify',
      };
    }

    if (this.scenario === 'preference_conflict') {
      return {
        status: 'ok',
        draft: this.baseDraft(request, {
          suggestionText: 'reduce contrast for a calmer look',
          preferenceConflict: ConflictState.POSSIBLE_CONFLICT,
          subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
          withBoldAlternative: true,
        }),
        providerAuditId: 'mock_pref',
      };
    }

    if (this.scenario === 'accessories_unknown') {
      return {
        status: 'ok',
        draft: this.accessoryDraft(request, {
          adviceType: FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
          observation:
            'Supporting shoes/bag/jewelry presence is unknown — do not invent existing pieces',
          suggestionText:
            'If you have not chosen shoes or a bag yet, quieter supporting directions are one option for a wedding context',
          withAccessoryAlternatives: true,
          assumptions: [
            'shoes presence UNKNOWN',
            'bag presence UNKNOWN',
            'jewelry presence UNKNOWN',
            'dress code unknown',
          ],
          clarificationNeeds: request.dressCode
            ? []
            : ['NEED_DRESS_CODE'],
        }),
        providerAuditId: 'mock_acc_unknown',
      };
    }

    if (this.scenario === 'accessories_known') {
      return {
        status: 'ok',
        draft: this.accessoryDraft(request, {
          adviceType: FashionAdviceType.PRESERVE_SUPPORTING_ELEMENTS,
          observation:
            'Gold metallic shoes and a black bag are present as supporting elements with the high-contrast garment pair',
          suggestionText:
            'One option is to preserve the bold garment contrast while keeping supporting pieces quieter or more formal',
          withAccessoryAlternatives: true,
          assumptions: ['dress code may still be unknown'],
        }),
        providerAuditId: 'mock_acc_known',
      };
    }

    if (this.scenario === 'absolute_accessory') {
      return {
        status: 'ok',
        draft: this.accessoryDraft(request, {
          suggestionText: 'this bag is wrong and gold is always better',
          rationale: 'these accessories do not suit you',
          absoluteClaim: true,
        }),
        providerAuditId: 'mock_acc_abs',
      };
    }

    if (this.scenario === 'gender_stereotype') {
      return {
        status: 'ok',
        draft: this.accessoryDraft(request, {
          suggestionText: 'women should wear smaller bags only',
          rationale: 'women should wear delicate jewelry',
        }),
        providerAuditId: 'mock_gender',
      };
    }

    if (this.scenario === 'brand_sku') {
      return {
        status: 'ok',
        draft: this.accessoryDraft(request, {
          suggestionText: 'Buy Gucci bag SKU-99881 in stock for $1200',
          rationale: 'Brand recommendation with price and stock',
        }),
        providerAuditId: 'mock_brand',
      };
    }

    if (this.scenario === 'cultural_generic_wedding') {
      return {
        status: 'ok',
        draft: this.culturalDraft(request, {
          observation:
            'Wedding occasion present; cultural region context unknown — generic occasion path only',
          suggestionText:
            'If you want a bolder wedding direction, preserving high color contrast is one option among alternatives',
          rationale:
            'Year-1 Mode B — no Saudi/Gulf assumption without explicit context; Law #38',
          withCulturalAlternatives: true,
        }),
        providerAuditId: 'mock_cult_generic',
      };
    }

    if (this.scenario === 'cultural_explicit_saudi_bold') {
      return {
        status: 'ok',
        draft: this.culturalDraft(request, {
          observation:
            'Explicit user-declared Saudi wedding context with bold style goal',
          suggestionText:
            'If you want a bold direction for this event, preserving statement color while qualifying formality expectations is one uncurated option',
          rationale:
            'Explicit cultural context consumed; preference preserved; no invented Saudi authority; UNCURATED Mode B',
          withCulturalAlternatives: true,
          culturalDependency: true,
          preferenceConflict: ConflictState.POSSIBLE_CONFLICT,
        }),
        providerAuditId: 'mock_cult_saudi_bold',
      };
    }

    if (this.scenario === 'cultural_stereotype') {
      return {
        status: 'ok',
        draft: this.culturalDraft(request, {
          suggestionText: 'Saudi women usually should wear more restrained colors',
          rationale: 'Because the user is Arabic-speaking she prefers modest fashion',
        }),
        providerAuditId: 'mock_cult_stereo',
      };
    }

    if (this.scenario === 'cultural_religious_ruling') {
      return {
        status: 'ok',
        draft: this.culturalDraft(request, {
          suggestionText: 'This outfit is religiously forbidden',
          rationale: 'According to Islam she must change the skirt',
        }),
        providerAuditId: 'mock_cult_religion',
      };
    }

    if (this.scenario === 'cultural_authority_claim') {
      return {
        status: 'ok',
        draft: this.culturalDraft(request, {
          suggestionText: 'Source: Saudi Cultural Dress Authority 2024 — yellow is banned',
          rationale: 'According to Vogue Gulf Editorial this must change',
          knowledgeType: KnowledgeType.CULTURAL_CONVENTION,
        }),
        providerAuditId: 'mock_cult_auth',
      };
    }

    if (this.scenario === 'form_volume_bold' || this.scenario === 'form_volume_minimal') {
      const bold = this.scenario === 'form_volume_bold';
      return {
        status: 'ok',
        draft: this.formDraft(request, {
          adviceType: bold
            ? FashionAdviceType.PRESERVE_VOLUME_CONTRAST
            : FashionAdviceType.BALANCE_VOLUME,
          observation:
            'Upper and lower pieces both present high visual volume between garments',
          suggestionText: bold
            ? 'Preserve volume contrast for a bold editorial garment relationship'
            : 'Reduce competing garment volume for a more streamlined outfit relationship',
          rationale:
            'Year-1 Mode B garment-proportion guidance — Law #37 forbids body judgment',
          withFormAlternatives: true,
          preferenceConflict: bold
            ? ConflictState.NO_CONFLICT
            : request.preferenceContext?.preferenceTokens?.some((t) =>
                /bold|editorial/i.test(t),
              )
              ? ConflictState.POSSIBLE_CONFLICT
              : ConflictState.NO_CONFLICT,
        }),
        providerAuditId: bold ? 'mock_form_bold' : 'mock_form_min',
      };
    }

    if (this.scenario === 'form_texture_evening') {
      return {
        status: 'ok',
        draft: this.formDraft(request, {
          adviceType: FashionAdviceType.PRESERVE_TEXTURE_CONTRAST,
          observation:
            'Lustrous and textured materials may create texture contrast; supporting metallic shoes present',
          suggestionText:
            'Texture contrast may be preserved or simplified depending on style goal — one direction among alternatives',
          rationale:
            'Material evidence limitations preserved; accessories consumed; no body claims',
          withFormAlternatives: true,
        }),
        providerAuditId: 'mock_form_texture',
      };
    }

    if (this.scenario === 'form_body_slimming') {
      return {
        status: 'ok',
        draft: this.formDraft(request, {
          suggestionText:
            'Choose this silhouette because it makes you look thinner',
          rationale: 'This hides your stomach and flatters your body',
        }),
        providerAuditId: 'mock_form_slim',
      };
    }

    if (this.scenario === 'form_body_shape') {
      return {
        status: 'ok',
        draft: this.formDraft(request, {
          suggestionText: 'Pear body should avoid wide-leg trousers',
          rationale: 'Hourglass is better for formal dinners',
        }),
        providerAuditId: 'mock_form_shape',
      };
    }

    // valid default — red/yellow/wedding friendly
    return {
      status: 'ok',
      draft: this.baseDraft(request, {
        withBoldAlternative: true,
        preferenceConflict: request.preferenceContext?.preferenceTokens?.some(
          (t) => /bold|statement/i.test(t),
        )
          ? ConflictState.POSSIBLE_CONFLICT
          : ConflictState.NO_CONFLICT,
      }),
      providerAuditId: 'mock_ok',
      latencyMs: 3,
      tokenUsage: { promptTokens: 100, completionTokens: 80 },
    };
  }

  private accessoryDraft(
    request: FashionLlmKnowledgeRequest,
    opts: {
      adviceType?: FashionAdviceType;
      observation?: string;
      suggestionText?: string;
      rationale?: string;
      withAccessoryAlternatives?: boolean;
      assumptions?: string[];
      clarificationNeeds?: string[];
      absoluteClaim?: boolean;
    },
  ): FashionAdviceCandidateDraft {
    const accessories = request.accessoryFacts ?? [];
    const unknownSlots = accessories.filter((a) => a.presence === 'UNKNOWN');
    const presentSlots = accessories.filter((a) => a.presence === 'PRESENT');
    const observation =
      opts.observation ??
      (unknownSlots.length > 0
        ? `Accessory slots unknown: ${unknownSlots.map((a) => a.category).join(',')}`
        : `Accessory slots present: ${presentSlots.map((a) => a.category).join(',')}`);

    const alternatives = opts.withAccessoryAlternatives
      ? [
          {
            alternativeId: 'alt_preserve_bold_quiet_support',
            direction: 'preserve_bold_quiet_support',
            changes: [
              {
                changeId: 'c_quiet_shoes',
                targetRef: 'accessory:shoes',
                action: 'replace_direction' as const,
                toDirection: 'quieter_neutral',
              },
            ],
            expectedStyleEffect: 'Bold garments preserved; quieter shoes direction',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'UNCURATED_MODEL_GUIDANCE',
            preferenceAlignment: 'partial' as const,
          },
          {
            alternativeId: 'alt_calmer_direction',
            direction: 'calmer_direction',
            changes: [
              {
                changeId: 'c_calm_bag',
                targetRef: 'accessory:bags',
                action: 'replace_direction' as const,
                toDirection: 'lower_intensity',
              },
            ],
            expectedStyleEffect: 'Reduce competing supporting intensity',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'STYLE_OPTION',
            preferenceAlignment: 'opposed' as const,
          },
          {
            alternativeId: 'alt_more_formal',
            direction: 'more_formal_direction',
            changes: [
              {
                changeId: 'c_formal_shoes',
                targetRef: 'accessory:shoes',
                action: 'replace_direction' as const,
                toDirection: 'higher_formality',
              },
            ],
            expectedStyleEffect: 'Supporting formality increased',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
            qualification: 'CONTEXT_DEPENDENT',
            preferenceAlignment: 'partial' as const,
          },
          {
            alternativeId: 'alt_clarify',
            direction: 'need_clarification',
            changes: [],
            expectedStyleEffect: 'Clarify dress code / style goal',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
            qualification: 'CONTEXT_DEPENDENT',
            preferenceAlignment: 'unknown' as const,
          },
        ]
      : [];

    return {
      draftId: `draft_fk6_${request.requestId}`,
      schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
      adviceType:
        opts.adviceType ?? FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
      targetRefs: [
        ...request.garmentFacts.map((g) => g.garmentId),
        ...accessories.map((a) => a.accessoryId),
      ],
      currentObservation: observation,
      suggestion: {
        structuredText:
          opts.suggestionText ??
          'Consider quieter supporting pieces as one styling direction',
        adviceType:
          opts.adviceType ?? FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
        absoluteClaim: opts.absoluteClaim === true,
        knownRuleWording: false,
      },
      rationale:
        opts.rationale ??
        'LLM general accessory guidance — Year-1 Mode B UNCURATED',
      evidenceRefs: [...request.evidenceRefs],
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      confidenceEstimate: KnowledgeConfidence.MEDIUM,
      preferenceConflict: request.preferenceContext?.preferenceTokens?.some(
        (t) => /bold|statement/i.test(t),
      )
        ? ConflictState.POSSIBLE_CONFLICT
        : ConflictState.NO_CONFLICT,
      culturalConflict: ConflictState.NO_CONFLICT,
      occasionDependency: Boolean(request.occasion),
      occasionContext: request.occasion ? [request.occasion] : [],
      assumptions: opts.assumptions ?? [],
      clarificationNeeds: opts.clarificationNeeds ?? [],
      alternatives,
      limitations: [
        'Uncurated LLM draft',
        'No product SKU',
        'No brand recommendation',
      ],
      createdAt: request.clockNowIso,
      traceId: request.traceId,
    };
  }

  private culturalDraft(
    request: FashionLlmKnowledgeRequest,
    opts: {
      observation?: string;
      suggestionText?: string;
      rationale?: string;
      withCulturalAlternatives?: boolean;
      culturalDependency?: boolean;
      preferenceConflict?: (typeof ConflictState)[keyof typeof ConflictState];
      knowledgeType?: KnowledgeType;
    },
  ): FashionAdviceCandidateDraft {
    const alternatives = opts.withCulturalAlternatives
      ? [
          {
            alternativeId: 'alt_traditional_direction',
            direction: 'more_traditional_direction',
            changes: [
              {
                changeId: 'c_trad',
                targetRef: 'outfit:cultural',
                action: 'replace_direction' as const,
                toDirection: 'traditional',
              },
            ],
            expectedStyleEffect: 'More traditional event direction (option)',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'CONTEXT_DEPENDENT',
            preferenceAlignment: 'partial' as const,
          },
          {
            alternativeId: 'alt_contemporary_direction',
            direction: 'contemporary_direction',
            changes: [
              {
                changeId: 'c_cont',
                targetRef: 'outfit:cultural',
                action: 'replace_direction' as const,
                toDirection: 'contemporary',
              },
            ],
            expectedStyleEffect: 'Contemporary event direction (option)',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'PREFERENCE_DEPENDENT',
            preferenceAlignment: 'aligned' as const,
          },
          {
            alternativeId: 'alt_fusion_direction',
            direction: 'balanced_fusion_direction',
            changes: [
              {
                changeId: 'c_fusion',
                targetRef: 'outfit:cultural',
                action: 'replace_direction' as const,
                toDirection: 'fusion',
              },
            ],
            expectedStyleEffect: 'Balanced/fusion direction (option)',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'STYLE_OPTION',
            preferenceAlignment: 'partial' as const,
          },
        ]
      : [];

    return {
      draftId: `draft_fk8_${request.requestId}`,
      schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
      adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
      targetRefs: request.garmentFacts.map((g) => g.garmentId),
      currentObservation:
        opts.observation ?? 'Occasion context observed; cultural identity not inferred',
      suggestion: {
        structuredText:
          opts.suggestionText ??
          'If the event has a specific dress expectation, clarify preferred direction',
        adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
        absoluteClaim: false,
        knownRuleWording: false,
      },
      rationale:
        opts.rationale ??
        'LLM cultural guidance — Year-1 Mode B UNCURATED; Law #38',
      evidenceRefs: [...request.evidenceRefs],
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      knowledgeType:
        opts.knowledgeType ?? KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      confidenceEstimate: KnowledgeConfidence.MEDIUM,
      preferenceConflict:
        opts.preferenceConflict ?? ConflictState.NO_CONFLICT,
      culturalConflict: opts.culturalDependency
        ? ConflictState.POSSIBLE_CONFLICT
        : ConflictState.NO_CONFLICT,
      occasionDependency: Boolean(request.occasion),
      occasionContext: request.occasion ? [request.occasion] : [],
      assumptions: [
        'Cultural context is not identity',
        ...(request.culturalContext
          ? [`cultural_token:${request.culturalContext}`]
          : ['cultural_context_unknown_or_weak']),
      ],
      clarificationNeeds: [],
      alternatives,
      limitations: [
        'Uncurated LLM draft',
        'Law #38 — no identity inference',
        'Not cultural authority',
        'No religious ruling',
        'No product SKU',
      ],
      createdAt: request.clockNowIso,
      traceId: request.traceId,
    };
  }

  private formDraft(
    request: FashionLlmKnowledgeRequest,
    opts: {
      adviceType?: FashionAdviceType;
      observation?: string;
      suggestionText?: string;
      rationale?: string;
      withFormAlternatives?: boolean;
      preferenceConflict?: (typeof ConflictState)[keyof typeof ConflictState];
      assumptions?: string[];
      clarificationNeeds?: string[];
    },
  ): FashionAdviceCandidateDraft {
    const alternatives = opts.withFormAlternatives
      ? [
          {
            alternativeId: 'alt_preserve_volume',
            direction: 'preserve_expressive_volume',
            changes: [
              {
                changeId: 'c_preserve_vol',
                targetRef: request.garmentFacts[0]?.garmentId ?? 'garment:upper',
                action: 'keep' as const,
                toDirection: 'preserve_volume_contrast',
              },
            ],
            expectedStyleEffect: 'Preserve bold garment volume relationship',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'PREFERENCE_DEPENDENT',
            preferenceAlignment: 'aligned' as const,
          },
          {
            alternativeId: 'alt_simplify_volume',
            direction: 'simplify_one_volume_dimension',
            changes: [
              {
                changeId: 'c_balance_vol',
                targetRef: request.garmentFacts[1]?.garmentId ?? 'garment:lower',
                action: 'replace_direction' as const,
                toDirection: 'reduce_competing_volume',
              },
            ],
            expectedStyleEffect:
              'Reduce competing visual volume between garments',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'STYLE_OPTION',
            preferenceAlignment: 'opposed' as const,
          },
          {
            alternativeId: 'alt_increase_formality',
            direction: 'increase_formality',
            changes: [
              {
                changeId: 'c_formal',
                targetRef: 'outfit:form',
                action: 'replace_direction' as const,
                toDirection: 'higher_structure',
              },
            ],
            expectedStyleEffect:
              'Increase structural formality of garment relationships',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
            qualification: 'CONTEXT_DEPENDENT',
            preferenceAlignment: 'partial' as const,
          },
          {
            alternativeId: 'alt_clarify_goal',
            direction: 'need_clarification',
            changes: [],
            expectedStyleEffect: 'Clarify desired style goal',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
            qualification: 'CONTEXT_DEPENDENT',
            preferenceAlignment: 'unknown' as const,
          },
        ]
      : [];

    return {
      draftId: `draft_fk7_${request.requestId}`,
      schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
      adviceType: opts.adviceType ?? FashionAdviceType.BALANCE_VOLUME,
      targetRefs: request.garmentFacts.map((g) => g.garmentId),
      currentObservation:
        opts.observation ??
        'Garment silhouette and volume relationships observed',
      suggestion: {
        structuredText:
          opts.suggestionText ??
          'Adjust garment visual volume relationship as one styling direction',
        adviceType: opts.adviceType ?? FashionAdviceType.BALANCE_VOLUME,
        absoluteClaim: false,
        knownRuleWording: false,
      },
      rationale:
        opts.rationale ??
        'LLM general fabric/silhouette guidance — Year-1 Mode B UNCURATED; Law #37',
      evidenceRefs: [...request.evidenceRefs],
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      confidenceEstimate: KnowledgeConfidence.MEDIUM,
      preferenceConflict:
        opts.preferenceConflict ??
        (request.preferenceContext?.preferenceTokens?.some((t) =>
          /bold|minimal/i.test(t),
        )
          ? ConflictState.POSSIBLE_CONFLICT
          : ConflictState.NO_CONFLICT),
      culturalConflict: ConflictState.NO_CONFLICT,
      occasionDependency: Boolean(request.occasion),
      occasionContext: request.occasion ? [request.occasion] : [],
      assumptions: opts.assumptions ?? [
        'Proportion describes garment-to-garment relationships only',
      ],
      clarificationNeeds: opts.clarificationNeeds ?? [],
      alternatives,
      limitations: [
        'Uncurated LLM draft',
        'Law #37 — no body judgment',
        'No product SKU',
        'OI layering CONSUME_ONLY',
      ],
      createdAt: request.clockNowIso,
      traceId: request.traceId,
    };
  }

  private baseDraft(
    request: FashionLlmKnowledgeRequest,
    opts: {
      rationale?: string;
      suggestionText?: string;
      adviceType?: FashionAdviceType;
      occasionContext?: string[];
      occasionDependency?: boolean;
      clarificationNeeds?: string[];
      assumptions?: string[];
      preferenceConflict?: ConflictState;
      subjectivity?: SubjectivityLevel;
      withBoldAlternative?: boolean;
    } = {},
  ): FashionAdviceCandidateDraft {
    const colors = request.garmentFacts.flatMap((g) => g.colors ?? []);
    const observation =
      colors.length >= 2
        ? `${colors[0]} and ${colors[1]} garments form a high-contrast color relationship`
        : 'Garment colors present in outfit context';

    const alternatives = opts.withBoldAlternative
      ? [
          {
            alternativeId: 'alt_preserve_bold',
            direction: 'preserve_bold_statement',
            changes: [
              {
                changeId: 'c_keep',
                targetRef: 'look',
                action: 'keep' as const,
              },
            ],
            expectedStyleEffect: 'Bold statement preserved',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.USER_DEPENDENT,
            qualification: 'Preference-aligned option',
            preferenceAlignment: 'aligned' as const,
          },
          {
            alternativeId: 'alt_reduce_contrast',
            direction: 'calm_the_look',
            changes: [
              {
                changeId: 'c_soft',
                targetRef: request.garmentFacts[1]?.garmentId ?? 'garment:2',
                action: 'neutralize_color' as const,
                toDirection: 'neutral',
              },
            ],
            expectedStyleEffect: 'Lower color intensity',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'LLM suggestion only',
            preferenceAlignment: 'opposed' as const,
          },
          {
            alternativeId: 'alt_neutral_accessories',
            direction: 'neutralize_accessories',
            changes: [
              {
                changeId: 'c_acc',
                targetRef: 'accessory',
                action: 'replace_direction' as const,
                toDirection: 'metallic_neutral',
              },
            ],
            expectedStyleEffect: 'Calm with accessory direction',
            evidenceRefs: [...request.evidenceRefs],
            ruleRefs: [] as string[],
            confidence: KnowledgeConfidence.LOW,
            subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
            qualification: 'Hybrid option',
            preferenceAlignment: 'partial' as const,
          },
        ]
      : [];

    return {
      draftId: `draft_${request.requestId}`,
      schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
      adviceType: opts.adviceType ?? FashionAdviceType.BALANCE_COLOR,
      targetRefs: request.garmentFacts.map((g) => g.garmentId),
      currentObservation: observation,
      suggestion: {
        structuredText:
          opts.suggestionText ??
          'One option is to soften one strong color or neutralize accessories',
        adviceType: opts.adviceType ?? FashionAdviceType.BALANCE_COLOR,
        absoluteClaim: false,
        knownRuleWording: false,
      },
      rationale:
        opts.rationale ??
        'LLM general fashion suggestion — uncurated Mode B candidate draft',
      evidenceRefs: [...request.evidenceRefs],
      subjectivity: opts.subjectivity ?? SubjectivityLevel.HIGH_SUBJECTIVITY,
      knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      confidenceEstimate: KnowledgeConfidence.MEDIUM,
      preferenceConflict: opts.preferenceConflict ?? ConflictState.NO_CONFLICT,
      culturalConflict: ConflictState.NO_CONFLICT,
      occasionDependency: opts.occasionDependency ?? false,
      occasionContext: opts.occasionContext,
      assumptions: opts.assumptions ?? [],
      clarificationNeeds: opts.clarificationNeeds ?? [],
      alternatives,
      limitations: ['Uncurated LLM draft'],
      createdAt: request.clockNowIso,
      traceId: request.traceId,
    };
  }
}
