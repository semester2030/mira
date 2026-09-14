/**
 * FK-2 — TEST_ONLY synthetic fixtures.
 * Never ship as production fashion knowledge.
 */
import { FashionAdviceType } from '../contracts/advice-types';
import { ConditionField, ConditionOperator } from '../contracts/conditions';
import { KnowledgeConfidence } from '../contracts/confidence';
import { ConflictState } from '../contracts/conflicts';
import { KnowledgeType } from '../contracts/knowledge-types';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
  llmUncuratedProvenance,
} from '../contracts/provenance';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { SubjectivityLevel } from '../contracts/subjectivity';
import {
  CandidateSourceType,
  CandidateStatus,
  PresentationEligibility,
  type FashionAdviceCandidate,
} from '../advice/advice-candidate';
import {
  RuleLifecycleStatus,
  type FashionKnowledgeRule,
} from '../knowledge/fashion-knowledge-rule';
import {
  FASHION_ADVICE_CANDIDATE_VERSION,
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_TEST_ONLY,
} from '../versioning/release';

export const TEST_RULE_COLOR_CONTRAST: FashionKnowledgeRule = {
  ruleId: 'TEST_RULE_COLOR_CONTRAST',
  schemaVersion: FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  ruleVersion: '0.0.1-test',
  knowledgeType: KnowledgeType.CONVENTION,
  domain: FashionRuleDomain.COLOR,
  conditions: [
    {
      field: ConditionField.COLOR,
      operator: ConditionOperator.IN,
      value: ['red', 'yellow'],
    },
  ],
  recommendationPattern: {
    patternId: 'pat_reduce_contrast',
    adviceTypeHint: FashionAdviceType.REDUCE_CONTRAST,
    structuredSuggestion:
      'Optionally soften one high-contrast color toward a calmer direction',
    allowsMultipleAlternatives: true,
  },
  rationale:
    'TEST_ONLY synthetic convention: strong red+yellow contrast is visually intense',
  applicability: [
    {
      applicabilityId: 'app_color_general',
      notes: 'General color convention — not universal taste',
    },
  ],
  exceptions: [
    {
      exceptionId: 'ex_user_requests_bold',
      description: 'User explicitly wants bold contrast',
      whenValues: ['bold_requested'],
      blocksAdvice: false,
      notes: 'Preference may keep look; qualify instead of block',
    },
  ],
  subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
  confidence: KnowledgeConfidence.MEDIUM,
  provenance: {
    sourceId: 'test_source_editorial',
    sourceType: ProvenanceSourceType.MIRA_EDITORIAL,
    title: 'TEST_ONLY Mira Editorial Fixture',
    approvalStatus: ProvenanceApprovalStatus.APPROVED,
    sourceConfidence: 0.7,
    notes: FASHION_KNOWLEDGE_TEST_ONLY,
  },
  occasionContext: [],
  culturalContext: [],
  conflictRefs: [],
  status: RuleLifecycleStatus.ACTIVE,
  lifecycle: RuleLifecycleStatus.ACTIVE,
  testOnly: true,
};

export const TEST_RULE_WEDDING_CONTEXT: FashionKnowledgeRule = {
  ruleId: 'TEST_RULE_WEDDING_CONTEXT',
  schemaVersion: FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  ruleVersion: '0.0.1-test',
  knowledgeType: KnowledgeType.DRESS_CODE_RULE,
  domain: FashionRuleDomain.OCCASION,
  conditions: [
    {
      field: ConditionField.OCCASION,
      operator: ConditionOperator.EQUALS,
      value: 'wedding',
    },
  ],
  recommendationPattern: {
    patternId: 'pat_wedding_context',
    adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
    structuredSuggestion:
      'For wedding context, consider calmer formality options alongside bold looks',
    allowsMultipleAlternatives: true,
  },
  rationale: 'TEST_ONLY synthetic dress-code context for wedding occasion',
  applicability: [
    {
      applicabilityId: 'app_wedding_required',
      requiredOccasions: ['wedding'],
    },
  ],
  exceptions: [],
  subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
  confidence: KnowledgeConfidence.MEDIUM,
  provenance: {
    sourceId: 'test_source_dress_code',
    sourceType: ProvenanceSourceType.MIRA_EDITORIAL,
    approvalStatus: ProvenanceApprovalStatus.APPROVED,
    sourceConfidence: 0.65,
    notes: FASHION_KNOWLEDGE_TEST_ONLY,
  },
  occasionContext: ['wedding'],
  culturalContext: [],
  conflictRefs: [],
  status: RuleLifecycleStatus.ACTIVE,
  lifecycle: RuleLifecycleStatus.ACTIVE,
  testOnly: true,
};

const CREATED = '2026-08-10T00:00:00.000Z';

export function makeRedYellowWeddingCandidate(
  overrides: Partial<FashionAdviceCandidate> = {},
): FashionAdviceCandidate {
  const base: FashionAdviceCandidate = {
    candidateId: 'cand_red_yellow_wedding_test',
    schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
    adviceType: FashionAdviceType.REDUCE_CONTRAST,
    targetRefs: ['garment:blouse:red', 'garment:skirt:yellow'],
    currentObservation:
      'Red blouse with yellow skirt creates a high-contrast color relationship',
    suggestion: {
      structuredText:
        'One option is to soften one color toward a calmer direction for wedding context',
      adviceType: FashionAdviceType.REDUCE_CONTRAST,
      absoluteClaim: false,
      knownRuleWording: false,
    },
    rationale:
      'Synthetic TEST_ONLY candidate combining color contrast convention with wedding context',
    knowledgeRuleIds: [
      TEST_RULE_COLOR_CONTRAST.ruleId,
      TEST_RULE_WEDDING_CONTEXT.ruleId,
    ],
    knowledgeType: KnowledgeType.CONVENTION,
    sourceType: CandidateSourceType.MIRA_CURATED,
    provenanceState: ProvenanceApprovalStatus.APPROVED,
    provenance: TEST_RULE_COLOR_CONTRAST.provenance,
    evidenceRefs: ['ev_blouse_red', 'ev_skirt_yellow', 'ev_occasion_wedding'],
    confidence: KnowledgeConfidence.MEDIUM,
    subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
    occasionContext: ['wedding'],
    preferenceConflict: ConflictState.POSSIBLE_CONFLICT,
    culturalConflict: ConflictState.NO_CONFLICT,
    limitations: ['Convention, not absolute taste judgment'],
    alternatives: [
      {
        alternativeId: 'alt_preserve_bold',
        direction: 'preserve_bold_statement',
        changes: [
          {
            changeId: 'c1',
            targetRef: 'look',
            action: 'keep',
            notes: 'Keep red+yellow if bold preference dominates',
          },
        ],
        expectedStyleEffect: 'Bold statement preserved',
        evidenceRefs: ['ev_pref_bold'],
        ruleRefs: [TEST_RULE_COLOR_CONTRAST.ruleId],
        confidence: KnowledgeConfidence.MEDIUM,
        subjectivity: SubjectivityLevel.USER_DEPENDENT,
        qualification: 'Preference-aligned alternative',
        preferenceAlignment: 'aligned',
      },
      {
        alternativeId: 'alt_calm_formal',
        direction: 'calm_formal',
        changes: [
          {
            changeId: 'c2',
            targetRef: 'garment:skirt:yellow',
            action: 'neutralize_color',
            toDirection: 'beige_or_champagne',
          },
        ],
        expectedStyleEffect: 'Lower contrast for formal wedding restraint',
        evidenceRefs: ['ev_occasion_wedding'],
        ruleRefs: [TEST_RULE_WEDDING_CONTEXT.ruleId],
        confidence: KnowledgeConfidence.MEDIUM,
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        qualification: 'Occasion-conventional alternative',
        preferenceAlignment: 'opposed',
      },
      {
        alternativeId: 'alt_hybrid',
        direction: 'hybrid_bold_with_calmer_accessory',
        changes: [
          {
            changeId: 'c3',
            targetRef: 'accessory:shoes',
            action: 'replace_direction',
            toDirection: 'metallic_neutral',
          },
        ],
        expectedStyleEffect: 'Keep garments, calm with accessory direction',
        evidenceRefs: ['ev_blouse_red', 'ev_skirt_yellow'],
        ruleRefs: [
          TEST_RULE_COLOR_CONTRAST.ruleId,
          TEST_RULE_WEDDING_CONTEXT.ruleId,
        ],
        confidence: KnowledgeConfidence.LOW,
        subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
        qualification: 'Hybrid option',
        preferenceAlignment: 'partial',
      },
    ],
    presentationEligibility: PresentationEligibility.ELIGIBLE_QUALIFIED,
    status: CandidateStatus.READY_FOR_LOCK,
    traceId: 'trace_fk2_red_yellow',
    createdAt: CREATED,
  };
  return { ...base, ...overrides };
}

export function makeLlmUncuratedCandidate(
  overrides: Partial<FashionAdviceCandidate> = {},
): FashionAdviceCandidate {
  const base: FashionAdviceCandidate = {
    candidateId: 'cand_llm_neutral_color',
    schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
    adviceType: FashionAdviceType.BALANCE_COLOR,
    targetRefs: ['garment:blouse:red', 'garment:skirt:yellow'],
    currentObservation: 'Two strong colors are present in the outfit',
    suggestion: {
      structuredText: 'replace one strong color with a neutral',
      adviceType: FashionAdviceType.BALANCE_COLOR,
      absoluteClaim: false,
      knownRuleWording: false,
    },
    rationale: 'LLM general fashion suggestion — uncurated Mode B',
    knowledgeRuleIds: [],
    knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
    sourceType: CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
    provenanceState: ProvenanceApprovalStatus.UNCURATED,
    provenance: llmUncuratedProvenance('llm_mode_b_fixture'),
    evidenceRefs: ['ev_blouse_red', 'ev_skirt_yellow'],
    confidence: KnowledgeConfidence.MEDIUM,
    subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
    preferenceConflict: ConflictState.NO_CONFLICT,
    culturalConflict: ConflictState.NO_CONFLICT,
    limitations: ['Uncurated LLM knowledge — not Mira established principle'],
    alternatives: [
      {
        alternativeId: 'alt_llm_neutral',
        direction: 'neutralize_one_color',
        changes: [
          {
            changeId: 'lc1',
            targetRef: 'garment:skirt:yellow',
            action: 'neutralize_color',
            toDirection: 'neutral',
          },
        ],
        expectedStyleEffect: 'Lower color intensity',
        evidenceRefs: ['ev_skirt_yellow'],
        ruleRefs: [],
        confidence: KnowledgeConfidence.LOW,
        subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
        qualification: 'LLM suggestion only',
        preferenceAlignment: 'unknown',
      },
    ],
    presentationEligibility: PresentationEligibility.ELIGIBLE_QUALIFIED,
    status: CandidateStatus.READY_FOR_LOCK,
    createdAt: CREATED,
  };
  return { ...base, ...overrides };
}

export function makeFalseProvenanceCandidate(): FashionAdviceCandidate {
  return makeLlmUncuratedCandidate({
    candidateId: 'cand_false_dior',
    claimsExternalPublication: true,
    provenance: {
      sourceId: 'unregistered_dior_manual',
      sourceType: ProvenanceSourceType.BOOK,
      title: 'Dior Styling Manual',
      author: 'Unknown',
      approvalStatus: ProvenanceApprovalStatus.APPROVED,
      sourceConfidence: 0.9,
    },
    provenanceState: ProvenanceApprovalStatus.APPROVED,
    knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
    sourceType: CandidateSourceType.MIRA_CURATED,
    suggestion: {
      structuredText: 'Source: Dior Styling Manual — change the skirt',
      adviceType: FashionAdviceType.BALANCE_COLOR,
      absoluteClaim: true,
      knownRuleWording: true,
    },
  });
}

export const ALL_TEST_ONLY_RULES: readonly FashionKnowledgeRule[] =
  Object.freeze([TEST_RULE_COLOR_CONTRAST, TEST_RULE_WEDDING_CONTEXT]);
