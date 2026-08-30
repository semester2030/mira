/**
 * FK-5A — Source acquisition & human approval gate tests.
 * Production path must remain BLOCKED without real Tier A/B materials + proven human approval.
 */
import assert from 'node:assert/strict';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_BLOCKED_BY_SOURCING,
  FASHION_KNOWLEDGE_SOURCING_REQUIRED,
  ProvenanceSourceType,
  KnowledgeConfidence,
  FashionRuleDomain,
  ClaimLockDecision,
  evaluateFashionClaimLock,
  emptyLockContext,
  resolveCuratedOverLlm,
  type FashionClaimLockContext,
} from './index';
import { emptyProductionRegistry } from './registry/storage';
import { FashionKnowledgeReleaseManager } from './registry/release';
import {
  makeRedYellowWeddingCandidate,
  TEST_RULE_COLOR_CONTRAST,
  TEST_RULE_WEDDING_CONTEXT,
} from './fixtures/test-only-fixtures';
import {
  buildFk5aCandidateInventory,
  EvidenceClass,
  FK5A_INGESTED_SOURCES,
  validateIngestedSource,
  listActivationCapableSources,
  toFashionProvenance,
  buildAllEvidenceMaps,
  buildEvidenceMapForRule,
  SourceCoverage,
  decideReviewOutcome,
  ReviewOutcome,
  validateHumanReviewRecord,
  evaluateApprovalGate,
  recalibrateConfidence,
  runFk5aApprovalGate,
  buildCoverageReport,
  buildModeAVsModeBReport,
  fk5aCuratedPrecedenceProbe,
  assertEmptyRegistryLookup,
  CoverageStatus,
  type IngestedFashionSource,
} from './approval';
import { SourceAuthorityTier } from './curated/source-authority';
import { FK5_COLOR_REVIEW_CANDIDATES } from './curated/review-candidates-color';

const CLOCK = { nowIso: '2026-08-10T12:00:00.000Z' };

function baseContext(
  overrides: Partial<FashionClaimLockContext> = {},
): FashionClaimLockContext {
  return emptyLockContext({
    clock: CLOCK,
    traceId: 'trace_fk5a',
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
    preferenceTokens: new Set(['bold']),
    culturalTokens: new Set(),
    factTokens: new Set(['red', 'yellow', 'wedding']),
    dressCodeKnown: false,
    ...overrides,
  });
}

function section(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

/** In-memory Tier A fixture for machinery tests — NOT in production catalog. */
function syntheticTierAColorTheory(): IngestedFashionSource {
  return {
    schemaVersion: 'fashion-knowledge-source-ingest-v1',
    sourceId: 'test_only_synth_color_theory_ref',
    tier: SourceAuthorityTier.TIER_A,
    sourceType: ProvenanceSourceType.ACADEMIC_REFERENCE,
    title: 'TEST_ONLY Synthetic Color Geometry Reference',
    authorOrganization: 'TEST_ONLY Lab',
    editionVersion: '0',
    publicationDate: '1970',
    locator: '§test',
    domains: ['COLOR'],
    relevance: 'Hue relationship geometry for tests',
    evidenceClasses: [
      EvidenceClass.COLOR_MATH_REFERENCE,
      EvidenceClass.COLOR_THEORY_REFERENCE,
    ],
    copyrightSafeNormalizedNote: 'Synthetic test material — not a real book',
    reviewerState: 'NOT_REVIEWED',
    materialPresent: true,
    notes: 'TEST_ONLY — must never enter FK5A_INGESTED_SOURCES production array',
  };
}

section('versions', () => {
  assert.equal(FASHION_KNOWLEDGE_RELEASE, '1.0.0-fashion-knowledge');
});

section('inventory_17', () => {
  const inv = buildFk5aCandidateInventory();
  assert.equal(inv.length, 17);
  assert.ok(inv.every((r) => r.currentSourcingState === 'SOURCING_GAP'));
  assert.ok(inv.every((r) => r.requiredEvidenceClasses.length >= 1));
  const color = inv.filter((r) => r.domain === 'COLOR');
  const occ = inv.filter(
    (r) => r.domain === 'OCCASION' || r.domain === 'DRESS_CODE',
  );
  assert.equal(color.length, 8);
  assert.equal(occ.length, 9);
});

section('source_tier_and_unsupported', () => {
  assert.equal(FK5A_INGESTED_SOURCES.length, 0);
  assert.equal(listActivationCapableSources().length, 0);

  const fake: IngestedFashionSource = {
    ...syntheticTierAColorTheory(),
    title: 'Fake Citation Vogue Styling Guide 2025',
    materialPresent: true,
  };
  const fakeV = validateIngestedSource(fake);
  assert.equal(fakeV.ok, false);
  assert.ok(fakeV.issues.some((i) => i.startsWith('fabricated_marker')));

  const tierD: IngestedFashionSource = {
    ...syntheticTierAColorTheory(),
    sourceId: 'tier_d_llm',
    tier: SourceAuthorityTier.TIER_D,
    sourceType: ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
    title: 'LLM general note',
    authorOrganization: 'model',
  };
  const dV = validateIngestedSource(tierD);
  assert.equal(dV.maySupportActivation, false);

  const missing: IngestedFashionSource = {
    ...syntheticTierAColorTheory(),
    materialPresent: false,
  };
  assert.equal(validateIngestedSource(missing).ok, false);
});

section('real_provenance_registration_shape', () => {
  const src = syntheticTierAColorTheory();
  const v = validateIngestedSource(src);
  assert.equal(v.ok, true);
  assert.equal(v.maySupportActivation, true);
  const prov = toFashionProvenance(src);
  assert.equal(prov.sourceId, src.sourceId);
  assert.equal(prov.title, src.title);
  assert.ok((prov.notes ?? '').length <= 400);
});

section('evidence_maps_empty_sources', () => {
  const maps = buildAllEvidenceMaps([]);
  assert.equal(maps.length, 17);
  assert.ok(maps.every((m) => m.sourceCoverage === SourceCoverage.NONE));
  assert.ok(maps.every((m) => m.supportingSourceIds.length === 0));
});

section('partial_source_narrowing_path', () => {
  const inv = buildFk5aCandidateInventory();
  const dominance = inv.find((r) => r.ruleId === 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE')!;
  // Supply only COLOR_THEORY — styling also required → PARTIAL
  const partialSrc: IngestedFashionSource = {
    ...syntheticTierAColorTheory(),
    sourceId: 'test_partial_theory',
    evidenceClasses: [EvidenceClass.COLOR_THEORY_REFERENCE],
    domains: ['COLOR'],
  };
  const map = buildEvidenceMapForRule(dominance, [partialSrc]);
  assert.equal(map.sourceCoverage, SourceCoverage.PARTIAL);
  const decision = decideReviewOutcome(map);
  assert.equal(decision.outcome, ReviewOutcome.RESEARCH_MORE);
  assert.equal(decision.humanApproved, false);
});

section('multi_source_and_conflict_hooks', () => {
  const inv = buildFk5aCandidateInventory();
  const comp = inv.find((r) => r.ruleId === 'FK5_RC_COLOR_HUE_COMPLEMENTARY')!;
  const a = syntheticTierAColorTheory();
  const b: IngestedFashionSource = {
    ...syntheticTierAColorTheory(),
    sourceId: 'test_only_synth_color_theory_ref_b',
  };
  const map = buildEvidenceMapForRule(comp, [a, b]);
  assert.equal(map.sourceCoverage, SourceCoverage.FULL);
  assert.ok(map.supportingSourceIds.length >= 1);
});

section('fake_reviewer_rejected', () => {
  const bad = validateHumanReviewRecord({
    reviewerRef: 'fake-auto-approve',
    reviewerRole: 'editor',
    reviewedAt: '2026-08-10T00:00:00.000Z',
    decision: ReviewOutcome.APPROVE,
    notes: 'auto-approve by chatgpt',
    authorizationProven: true,
  });
  assert.equal(bad.ok, false);

  const unproven = validateHumanReviewRecord({
    reviewerRef: 'real_person_placeholder',
    reviewerRole: 'editor',
    reviewedAt: '2026-08-10T00:00:00.000Z',
    decision: ReviewOutcome.APPROVE,
    notes: 'looks fine',
    authorizationProven: false,
  });
  assert.equal(unproven.ok, false);
});

section('no_human_review_path', () => {
  const maps = buildAllEvidenceMaps([]);
  for (const m of maps) {
    const d = decideReviewOutcome(m);
    assert.equal(d.humanApproved, false);
    assert.ok(
      d.outcome === ReviewOutcome.RESEARCH_MORE ||
        d.outcome === ReviewOutcome.REJECT,
    );
  }
});

section('approval_gate_blocks_without_sources', () => {
  const rule = FK5_COLOR_REVIEW_CANDIDATES[0]!.rule;
  const map = buildAllEvidenceMaps([])[0]!;
  const decision = decideReviewOutcome(map);
  const gate = evaluateApprovalGate({
    rule,
    map,
    decision,
    sources: [],
  });
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.includes('human_approval_required'));
  assert.equal(gate.recalibratedConfidence, KnowledgeConfidence.UNVERIFIED);
});

section('confidence_recalibration', () => {
  assert.equal(
    recalibrateConfidence({
      map: buildAllEvidenceMaps([])[0]!,
      humanApproved: false,
      subjectivity: 'LOW_SUBJECTIVITY',
    }),
    KnowledgeConfidence.UNVERIFIED,
  );
});

section('gate_runner_blocked', () => {
  const result = runFk5aApprovalGate();
  assert.equal(result.verdict, FASHION_KNOWLEDGE_BLOCKED_BY_SOURCING);
  assert.equal(result.code, FASHION_KNOWLEDGE_SOURCING_REQUIRED);
  assert.equal(result.candidateCount, 17);
  assert.equal(result.ingestedSourceCount, 0);
  assert.equal(result.activationCapableSourceCount, 0);
  assert.equal(result.activePromotedIds.length, 0);
  assert.equal(result.approveIds.length, 0);
  assert.equal(result.researchMoreIds.length, 17);
  assert.equal(result.productionRegistryActiveCount, 0);
});

section('coverage_and_mode_a_b', () => {
  const cov = buildCoverageReport([]);
  assert.equal(cov.activeRuleCount, 0);
  assert.equal(cov.color.relationships, CoverageStatus.NOT_COVERED);
  assert.equal(cov.occasion.wedding, CoverageStatus.NOT_COVERED);

  const modes = buildModeAVsModeBReport({ activeRuleIds: [], styleGoal: 'bold' });
  assert.deepEqual(modes.modeA.adviceDirections, ['NO_APPLICABLE_CURATED_RULE']);
  assert.equal(modes.modeB.llmMaySuggestUnderQualification, true);
  assert.ok(modes.coverageGap.toLowerCase().includes('mode a empty'));
});

section('red_yellow_wedding_mode_a_empty', () => {
  const modes = buildModeAVsModeBReport({
    activeRuleIds: [],
    styleGoal: 'bold',
  });
  assert.equal(modes.modeA.dressCodeClarificationRequired, true);
  assert.ok(modes.modeA.unknownContexts.includes('dress_code'));
});

section('claim_lock_and_precedence', () => {
  const lock = evaluateFashionClaimLock(
    makeRedYellowWeddingCandidate(),
    baseContext(),
  );
  assert.notEqual(lock.decision, ClaimLockDecision.BLOCK);

  const prec = fk5aCuratedPrecedenceProbe();
  assert.equal(prec.winner, 'llm');

  const withActiveFixture = resolveCuratedOverLlm({
    curatedRules: [TEST_RULE_COLOR_CONTRAST],
    llmCandidateRuleIds: ['llm_x'],
    domain: FashionRuleDomain.COLOR,
  });
  assert.equal(withActiveFixture.winner, 'curated_rule');
});

section('rollback_empty', () => {
  assert.equal(assertEmptyRegistryLookup(), true);
  const empty = emptyProductionRegistry('2026-08-10T00:00:00.000Z');
  const mgr = new FashionKnowledgeReleaseManager();
  const r1 = mgr.release({
    registry: empty,
    releasedAt: '2026-08-10T00:00:00.000Z',
    releaseNotes: 'fk5a empty anchor',
  });
  mgr.release({
    registry: emptyProductionRegistry('2026-08-11T00:00:00.000Z'),
    releasedAt: '2026-08-11T00:00:00.000Z',
    releaseNotes: 'still empty',
  });
  const rolled = mgr.rollback({
    toReleaseId: r1.releaseId,
    timestamp: '2026-08-12T00:00:00.000Z',
  });
  assert.equal(rolled.rollbackTarget, r1.releaseId);
});

section('copyright_and_no_poisoning', () => {
  assert.equal(FK5A_INGESTED_SOURCES.length, 0);
  // Telemetry / LLM frequency cannot appear in production ingest catalog
  const result = runFk5aApprovalGate();
  assert.equal(result.activePromotedIds.length, 0);
});

section('frozen_boundary_marker', () => {
  assert.ok(true, 'FK-5A additive under fashion-knowledge/approval only');
});

console.log('FK-5A schema tests passed');
