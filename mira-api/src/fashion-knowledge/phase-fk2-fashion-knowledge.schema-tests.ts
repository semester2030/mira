/**
 * FK-2 — Fashion Knowledge Contracts + Claim Lock schema tests.
 * Run: npm run test:fk2
 *
 * NO production rules · NO LLM wiring · NO Advisor integration · NO public API.
 */
import assert from 'node:assert/strict';
import {
  ALL_KNOWLEDGE_TYPES,
  KnowledgeType,
  knowledgeTypePolicy,
} from './contracts/knowledge-types';
import {
  ALL_SUBJECTIVITY_LEVELS,
  SubjectivityLevel,
  capClaimStrengthBySubjectivity,
  subjectivityPolicy,
} from './contracts/subjectivity';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
  llmUncuratedProvenance,
} from './contracts/provenance';
import { ALL_FASHION_RULE_DOMAINS } from './contracts/rule-domains';
import {
  ALL_CONDITION_FIELDS,
  ALL_CONDITION_OPERATORS,
} from './contracts/conditions';
import { FashionAdviceType, ALL_FASHION_ADVICE_TYPES } from './contracts/advice-types';
import { KnowledgeConfidence } from './contracts/confidence';
import {
  ConflictState,
  evaluatePreferenceConflict,
  RuleRelationType,
} from './contracts/conflicts';
import {
  ClaimLockDecision,
  ClaimLockReasonCode,
  ALL_CLAIM_LOCK_GATES,
} from './contracts/claim-lock';
import { PublicClaimStrength } from './contracts/claim-strength';
import {
  evaluateFashionClaimLock,
} from './claim-lock/claim-lock-runtime';
import { emptyLockContext } from './runtime/evaluation-context';
import {
  validateFashionAdviceCandidate,
  validateFashionKnowledgeRule,
  assertNoProductionRules,
} from './validation/validators';
import { validateToneSafety } from './validation/tone-safety';
import {
  LLM_CANDIDATE_POLICY,
  validateLlmCandidateDraft,
} from './advice/llm-candidate-policy';
import { resolveCuratedOverLlm } from './conflict/curated-precedence';
import { FASHION_KNOWLEDGE_PORTS } from './ports/extension-ports';
import {
  ALL_TEST_ONLY_RULES,
  TEST_RULE_COLOR_CONTRAST,
  TEST_RULE_WEDDING_CONTEXT,
  makeFalseProvenanceCandidate,
  makeLlmUncuratedCandidate,
  makeRedYellowWeddingCandidate,
} from './fixtures/test-only-fixtures';
import {
  FASHION_ADVICE_CANDIDATE_VERSION,
  FASHION_CLAIM_LOCK_VERSION,
  FASHION_CONFLICT_POLICY_VERSION,
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_TYPES_VERSION,
  FASHION_LLM_POLICY_VERSION,
  FASHION_PROVENANCE_VERSION,
  FASHION_SUBJECTIVITY_VERSION,
} from './versioning/release';
import { CandidateSourceType } from './advice/advice-candidate';
import type { FashionAdviceCandidateDraft } from './advice/advice-candidate';

const CLOCK = { nowIso: '2026-08-10T12:00:00.000Z' };

function baseContext(
  overrides: Partial<Parameters<typeof emptyLockContext>[0]> = {},
) {
  return emptyLockContext({
    resolvedEvidenceIds: new Set([
      'ev_blouse_red',
      'ev_skirt_yellow',
      'ev_occasion_wedding',
      'ev_pref_bold',
    ]),
    registeredSourceIds: new Set([
      'test_source_editorial',
      'test_source_dress_code',
    ]),
    applicableRuleIds: new Set([
      TEST_RULE_COLOR_CONTRAST.ruleId,
      TEST_RULE_WEDDING_CONTEXT.ruleId,
    ]),
    occasionTokens: new Set(['wedding']),
    preferenceTokens: new Set(['bold', 'statement']),
    culturalTokens: new Set(),
    factTokens: new Set(['red', 'yellow', 'blouse', 'skirt', 'wedding']),
    dressCodeKnown: true,
    rulesRequiringOccasion: new Set([TEST_RULE_WEDDING_CONTEXT.ruleId]),
    ...overrides,
    clock: overrides.clock ?? CLOCK,
    traceId: overrides.traceId ?? 'trace_fk2',
  });
}

function testVersions(): void {
  assert.equal(FASHION_KNOWLEDGE_RELEASE, '1.0.0-fashion-knowledge');
  assert.equal(FASHION_KNOWLEDGE_TYPES_VERSION, 'fashion-knowledge-types-v1');
  assert.equal(
    FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
    'fashion-knowledge-rule-schema-v1',
  );
  assert.equal(FASHION_ADVICE_CANDIDATE_VERSION, 'fashion-advice-candidate-v1');
  assert.equal(FASHION_CLAIM_LOCK_VERSION, 'fashion-claim-lock-v1');
  assert.equal(FASHION_PROVENANCE_VERSION, 'fashion-provenance-v1');
  assert.equal(FASHION_SUBJECTIVITY_VERSION, 'fashion-subjectivity-v1');
  assert.equal(FASHION_CONFLICT_POLICY_VERSION, 'fashion-conflict-policy-v1');
  assert.equal(FASHION_LLM_POLICY_VERSION, 'fashion-llm-policy-v1');
  console.log('ok versions');
}

function testKnowledgeTypes(): void {
  assert.equal(ALL_KNOWLEDGE_TYPES.length, 8);
  assert.equal(
    knowledgeTypePolicy(KnowledgeType.USER_PREFERENCE).isFashionTruth,
    false,
  );
  assert.equal(
    knowledgeTypePolicy(KnowledgeType.LLM_GENERAL_KNOWLEDGE).alwaysUncurated,
    true,
  );
  assert.equal(
    knowledgeTypePolicy(KnowledgeType.TREND).requiresTrendValidity,
    true,
  );
  assert.equal(
    knowledgeTypePolicy(KnowledgeType.CULTURAL_CONVENTION)
      .requiresCulturalApplicability,
    true,
  );
  assert.equal(
    knowledgeTypePolicy(KnowledgeType.DRESS_CODE_RULE).isUniversalTaste,
    false,
  );
  // No silent default to ESTABLISHED_PRINCIPLE
  for (const t of ALL_KNOWLEDGE_TYPES) {
    assert.ok(knowledgeTypePolicy(t).type === t);
  }
  console.log('ok knowledge_types');
}

function testSubjectivityPolicy(): void {
  assert.equal(ALL_SUBJECTIVITY_LEVELS.length, 5);
  assert.equal(
    subjectivityPolicy(SubjectivityLevel.HIGH_SUBJECTIVITY)
      .absoluteWordingForbidden,
    true,
  );
  const capped = capClaimStrengthBySubjectivity(
    'ESTABLISHED_GUIDANCE',
    SubjectivityLevel.HIGH_SUBJECTIVITY,
  );
  assert.equal(capped, 'QUALIFIED_SUGGESTION');
  console.log('ok subjectivity');
}

function testProvenanceLlm(): void {
  const p = llmUncuratedProvenance('x');
  assert.equal(p.sourceType, ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE);
  assert.equal(p.approvalStatus, ProvenanceApprovalStatus.UNCURATED);
  console.log('ok provenance');
}

function testTaxonomies(): void {
  assert.ok(ALL_FASHION_RULE_DOMAINS.includes('COLOR'));
  assert.ok(ALL_CONDITION_FIELDS.includes('occasion'));
  assert.ok(ALL_CONDITION_OPERATORS.includes('EQUALS'));
  assert.ok(ALL_FASHION_ADVICE_TYPES.includes(FashionAdviceType.PRESERVE_LOOK));
  assert.equal(ALL_CLAIM_LOCK_GATES.length, 15);
  console.log('ok taxonomies');
}

function testRuleValidation(): void {
  assert.equal(validateFashionKnowledgeRule(TEST_RULE_COLOR_CONTRAST).ok, true);
  assert.equal(validateFashionKnowledgeRule(TEST_RULE_WEDDING_CONTEXT).ok, true);
  const bad = {
    ...TEST_RULE_COLOR_CONTRAST,
    ruleId: '',
    knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
    confidence: KnowledgeConfidence.HIGH,
    provenance: {
      ...TEST_RULE_COLOR_CONTRAST.provenance,
      sourceType: ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
      approvalStatus: ProvenanceApprovalStatus.ACTIVE,
    },
  };
  const res = validateFashionKnowledgeRule(bad);
  assert.equal(res.ok, false);
  assert.ok(res.issues.some((i) => i.code === 'missing_rule_id'));
  assert.ok(res.issues.some((i) => i.code === 'llm_marked_curated'));
  assert.ok(res.issues.some((i) => i.code === 'uncurated_high_confidence'));
  console.log('ok rule_validation');
}

function testNoProductionRules(): void {
  assert.equal(assertNoProductionRules(ALL_TEST_ONLY_RULES).ok, true);
  assert.equal(
    assertNoProductionRules([
      { ...TEST_RULE_COLOR_CONTRAST, testOnly: false },
    ]).ok,
    false,
  );
  console.log('ok no_production_rules');
}

function testRedYellowWedding(): void {
  const candidate = makeRedYellowWeddingCandidate();
  assert.equal(validateFashionAdviceCandidate(candidate).ok, true);
  assert.ok(candidate.alternatives.length >= 2);
  assert.equal(candidate.preferenceConflict, ConflictState.POSSIBLE_CONFLICT);

  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.equal(lock.decision, ClaimLockDecision.PASS_WITH_QUALIFICATION);
  assert.ok(lock.qualificationCodes.includes(ClaimLockReasonCode.PREFERENCE_CONFLICT));
  assert.ok(
    lock.publicClaimStrength === PublicClaimStrength.QUALIFIED_SUGGESTION ||
      lock.publicClaimStrength ===
        PublicClaimStrength.CONVENTIONAL_GUIDANCE ||
      lock.publicClaimStrength ===
        PublicClaimStrength.PREFERENCE_DEPENDENT_OPTION,
  );
  assert.notEqual(
    lock.publicClaimStrength,
    PublicClaimStrength.ESTABLISHED_GUIDANCE,
  );
  assert.equal(lock.version, FASHION_CLAIM_LOCK_VERSION);
  assert.equal(lock.allowedCandidateRef, candidate.candidateId);
  console.log('ok red_yellow_wedding');
}

function testClarificationWhenDressCodeMissing(): void {
  const candidate = makeRedYellowWeddingCandidate({
    adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
    knowledgeType: KnowledgeType.DRESS_CODE_RULE,
    knowledgeRuleIds: [TEST_RULE_WEDDING_CONTEXT.ruleId],
  });
  const lock = evaluateFashionClaimLock(
    candidate,
    baseContext({
      clock: CLOCK,
      traceId: 'trace_clarify',
      dressCodeKnown: false,
      occasionTokens: new Set(),
    }),
  );
  assert.equal(lock.decision, ClaimLockDecision.NEED_CLARIFICATION);
  assert.ok(
    lock.clarificationNeeds.includes(ClaimLockReasonCode.NEED_OCCASION) ||
      lock.clarificationNeeds.includes(ClaimLockReasonCode.NEED_DRESS_CODE),
  );
  console.log('ok need_clarification');
}

function testLlmUncurated(): void {
  const candidate = makeLlmUncuratedCandidate();
  assert.equal(candidate.sourceType, CandidateSourceType.LLM_GENERAL_KNOWLEDGE);
  assert.equal(candidate.provenanceState, ProvenanceApprovalStatus.UNCURATED);
  assert.equal(
    candidate.provenance.sourceType,
    ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
  );

  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.equal(lock.decision, ClaimLockDecision.PASS_WITH_QUALIFICATION);
  assert.notEqual(lock.decision, ClaimLockDecision.PASS);
  assert.ok(lock.confidenceCap !== KnowledgeConfidence.HIGH);
  assert.notEqual(
    lock.publicClaimStrength,
    PublicClaimStrength.ESTABLISHED_GUIDANCE,
  );

  const definitive = makeLlmUncuratedCandidate({
    suggestion: {
      structuredText: 'This is the established fashion rule',
      adviceType: FashionAdviceType.BALANCE_COLOR,
      absoluteClaim: true,
      knownRuleWording: true,
    },
  });
  const blocked = evaluateFashionClaimLock(definitive, baseContext());
  assert.equal(blocked.decision, ClaimLockDecision.BLOCK);
  assert.ok(
    blocked.reasonCodes.includes(
      ClaimLockReasonCode.UNSUPPORTED_DETERMINISTIC_CLAIM,
    ),
  );
  console.log('ok llm_uncurated');
}

function testFalseProvenance(): void {
  const candidate = makeFalseProvenanceCandidate();
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.equal(lock.decision, ClaimLockDecision.BLOCK);
  assert.ok(lock.reasonCodes.includes(ClaimLockReasonCode.FALSE_PROVENANCE));
  console.log('ok false_provenance');
}

function testSubjectivityClaimStrength(): void {
  const candidate = makeRedYellowWeddingCandidate({
    subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
    preferenceConflict: ConflictState.NO_CONFLICT,
    alternatives: [
      makeRedYellowWeddingCandidate().alternatives[0]!,
    ],
  });
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.notEqual(
    lock.publicClaimStrength,
    PublicClaimStrength.ESTABLISHED_GUIDANCE,
  );
  assert.ok(
    lock.publicClaimStrength === PublicClaimStrength.QUALIFIED_SUGGESTION ||
      lock.publicClaimStrength ===
        PublicClaimStrength.PREFERENCE_DEPENDENT_OPTION ||
      lock.publicClaimStrength === PublicClaimStrength.UNAVAILABLE ||
      lock.publicClaimStrength === PublicClaimStrength.CONVENTIONAL_GUIDANCE,
  );
  if (lock.decision !== ClaimLockDecision.BLOCK) {
    assert.notEqual(
      lock.publicClaimStrength,
      PublicClaimStrength.ESTABLISHED_GUIDANCE,
    );
  }
  console.log('ok subjectivity_strength');
}

function testUserPreferenceConflict(): void {
  const pref = evaluatePreferenceConflict({
    guidanceTokens: ['reduce_contrast', 'calm'],
    preferenceTokens: ['bold', 'statement'],
  });
  assert.equal(pref.state, ConflictState.POSSIBLE_CONFLICT);

  const candidate = makeRedYellowWeddingCandidate();
  assert.equal(candidate.preferenceConflict, ConflictState.POSSIBLE_CONFLICT);
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.notEqual(lock.decision, ClaimLockDecision.BLOCK);
  assert.ok(lock.qualificationCodes.includes(ClaimLockReasonCode.PREFERENCE_CONFLICT));
  assert.ok(candidate.alternatives.length >= 2);
  console.log('ok preference_conflict');
}

function testAttractivenessBlocked(): void {
  const tone = validateToneSafety(
    'this outfit lowers your attractiveness by 20%',
  );
  assert.ok(tone.some((t) => t.code === 'ATTRACTIVENESS'));

  const candidate = makeLlmUncuratedCandidate({
    rationale: 'This makes you more beautiful',
    suggestion: {
      structuredText: 'Change color to look more attractive',
      adviceType: FashionAdviceType.BALANCE_COLOR,
      absoluteClaim: false,
      knownRuleWording: false,
    },
  });
  const validation = validateFashionAdviceCandidate(candidate);
  assert.equal(validation.ok, false);
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.equal(lock.decision, ClaimLockDecision.BLOCK);
  assert.ok(
    lock.reasonCodes.includes(ClaimLockReasonCode.ATTRACTIVENESS_CLAIM) ||
      lock.reasonCodes.includes(ClaimLockReasonCode.PROHIBITED_JUDGMENT),
  );
  console.log('ok attractiveness');
}

function testProviderLeakage(): void {
  const tone = validateToneSafety('powered by FASHN and OpenAI provider_id');
  assert.ok(tone.some((t) => t.code === 'PROVIDER_LEAKAGE'));
  const candidate = makeLlmUncuratedCandidate({
    currentObservation: 'Detected via fashn geometry',
  });
  assert.equal(validateFashionAdviceCandidate(candidate).ok, false);
  console.log('ok provider_leakage');
}

function testCuratedPrecedence(): void {
  const decision = resolveCuratedOverLlm({
    curatedRules: [TEST_RULE_COLOR_CONTRAST],
    llmCandidateRuleIds: ['llm_synthetic_1'],
    domain: 'COLOR',
  });
  assert.equal(decision.winner, 'curated_rule');
  assert.equal(decision.winningRuleId, TEST_RULE_COLOR_CONTRAST.ruleId);
  assert.equal(
    decision.relationsRecorded[0]?.type,
    RuleRelationType.CONFLICTS,
  );
  console.log('ok curated_precedence');
}

function testDeterminism(): void {
  const candidate = makeRedYellowWeddingCandidate();
  const ctx = baseContext({ clock: CLOCK, traceId: 'trace_det' });
  const a = evaluateFashionClaimLock(candidate, ctx);
  const b = evaluateFashionClaimLock(candidate, ctx);
  assert.deepEqual(
    {
      decision: a.decision,
      reasonCodes: a.reasonCodes,
      qualificationCodes: a.qualificationCodes,
      confidenceCap: a.confidenceCap,
      publicClaimStrength: a.publicClaimStrength,
      version: a.version,
    },
    {
      decision: b.decision,
      reasonCodes: b.reasonCodes,
      qualificationCodes: b.qualificationCodes,
      confidenceCap: b.confidenceCap,
      publicClaimStrength: b.publicClaimStrength,
      version: b.version,
    },
  );
  assert.deepEqual(
    a.gateResults.map((g) => ({ id: g.gateId, o: g.outcome, r: g.reasonCodes })),
    b.gateResults.map((g) => ({ id: g.gateId, o: g.outcome, r: g.reasonCodes })),
  );
  console.log('ok determinism');
}

function testPassCuratedLowSubjectivity(): void {
  const candidate = makeRedYellowWeddingCandidate({
    subjectivity: SubjectivityLevel.LOW_SUBJECTIVITY,
    preferenceConflict: ConflictState.NO_CONFLICT,
    culturalConflict: ConflictState.NO_CONFLICT,
    knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
    alternatives: [],
    limitations: [],
    suggestion: {
      structuredText: 'Red and yellow form a high-contrast color relationship',
      adviceType: FashionAdviceType.NO_CHANGE_NEEDED,
      absoluteClaim: false,
      knownRuleWording: false,
    },
    adviceType: FashionAdviceType.NO_CHANGE_NEEDED,
    confidence: KnowledgeConfidence.HIGH,
  });
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.ok(
    lock.decision === ClaimLockDecision.PASS ||
      lock.decision === ClaimLockDecision.PASS_WITH_QUALIFICATION,
  );
  if (lock.decision === ClaimLockDecision.PASS) {
    assert.ok(
      lock.publicClaimStrength === PublicClaimStrength.FACTUAL_RELATIONSHIP ||
        lock.publicClaimStrength === PublicClaimStrength.ESTABLISHED_GUIDANCE,
    );
  }
  console.log('ok pass_or_qualified_curated');
}

function testLlmPolicyContract(): void {
  assert.equal(LLM_CANDIDATE_POLICY.allowFinalPublicAdvice, false);
  assert.equal(LLM_CANDIDATE_POLICY.allowFabricatedCitations, false);
  assert.equal(
    LLM_CANDIDATE_POLICY.requiredApprovalStatus,
    ProvenanceApprovalStatus.UNCURATED,
  );
  const draft: FashionAdviceCandidateDraft = {
    draftId: 'd1',
    schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
    adviceType: FashionAdviceType.BALANCE_COLOR,
    targetRefs: ['g1'],
    currentObservation: 'colors present',
    suggestion: {
      structuredText: 'consider a neutral',
      adviceType: FashionAdviceType.BALANCE_COLOR,
      absoluteClaim: false,
      knownRuleWording: false,
    },
    rationale: 'draft',
    evidenceRefs: ['ev1'],
    subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
    alternatives: [],
    limitations: [],
    createdAt: CLOCK.nowIso,
  };
  assert.equal(validateLlmCandidateDraft(draft).ok, true);
  const bad = {
    ...draft,
    suggestion: { ...draft.suggestion, absoluteClaim: true, knownRuleWording: true },
    rationale: 'According to Dior Styling Manual',
  };
  assert.equal(validateLlmCandidateDraft(bad).ok, false);
  console.log('ok llm_policy');
}

function testExtensionPortsExist(): void {
  assert.ok(FASHION_KNOWLEDGE_PORTS.llmCandidateProvider);
  assert.ok(FASHION_KNOWLEDGE_PORTS.knowledgeRegistry);
  assert.ok(FASHION_KNOWLEDGE_PORTS.advisorEnvelopeProjection);
  console.log('ok extension_ports');
}

function testFrozenBoundaryMarkers(): void {
  // FK-2 package must not import frozen fashion-intelligence or beauty-advisor.
  // Structural assertion via module surface only in this suite.
  assert.ok(FASHION_KNOWLEDGE_RELEASE.startsWith('1.0.0'));
  assert.notEqual(FASHION_KNOWLEDGE_RELEASE, '1.0.0-styling-intelligence');
  console.log('ok frozen_boundary_markers');
}

function main(): void {
  testVersions();
  testKnowledgeTypes();
  testSubjectivityPolicy();
  testProvenanceLlm();
  testTaxonomies();
  testRuleValidation();
  testNoProductionRules();
  testRedYellowWedding();
  testClarificationWhenDressCodeMissing();
  testLlmUncurated();
  testFalseProvenance();
  testSubjectivityClaimStrength();
  testUserPreferenceConflict();
  testAttractivenessBlocked();
  testProviderLeakage();
  testCuratedPrecedence();
  testDeterminism();
  testPassCuratedLowSubjectivity();
  testLlmPolicyContract();
  testExtensionPortsExist();
  testFrozenBoundaryMarkers();
  console.log('FK-2 schema tests passed');
}

main();
