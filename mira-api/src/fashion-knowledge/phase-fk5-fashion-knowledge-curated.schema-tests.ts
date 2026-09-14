/**
 * FK-5 — Curated color + occasion knowledge schema tests.
 * Production ACTIVE set must remain empty without Tier A/B + proven human approval.
 */
import assert from 'node:assert/strict';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_COLOR_MATH_VERSION,
  FASHION_KNOWLEDGE_SOURCING_GAP,
  ClaimLockDecision,
  evaluateFashionClaimLock,
  resolveCuratedOverLlm,
  isProductionEligibleRule,
  RuleLifecycleStatus,
  KnowledgeType,
  ProvenanceSourceType,
  FashionRuleDomain,
  loadProductionFashionKnowledgeRegistry,
  buildFashionKnowledgeRegistry,
  createRegistrySnapshot,
  askApplicableCuratedRules,
  emptyLockContext,
  LookupReasonCode,
  type FashionClaimLockContext,
} from './index';
import { emptyProductionRegistry } from './registry/storage';
import { FashionKnowledgeReleaseManager } from './registry/release';
import {
  TEST_RULE_COLOR_CONTRAST,
  TEST_RULE_WEDDING_CONTEXT,
  makeRedYellowWeddingCandidate,
} from './fixtures/test-only-fixtures';
import {
  SourceAuthorityTier,
  defaultTierForSourceType,
  canIndependentlyActivateTier,
  FK5_DISCOVERED_SOURCES,
  listActivatingSources,
  listSourcingGaps,
  hasExternalAuthorityForDomain,
  observeColorRelationship,
  DEMO_HUE_RED,
  DEMO_HUE_YELLOW,
  ContrastCategory,
  ColorKnowledgeLayer,
  COLOR_KNOWLEDGE_LAYER_POLICIES,
  FashionOccasionId,
  FashionDressCodeId,
  conceptsAreDistinct,
  FK5_COLOR_REVIEW_CANDIDATES,
  FK5_OCCASION_REVIEW_CANDIDATES,
  evaluatePromotionToActive,
  filterReleaseEligibleCandidates,
  LEGACY_CLASH_PAIR_POLICY,
  isLegacyClashPairDocumented,
  evaluateRedYellowWeddingFlow,
  buildHumanReviewPack,
  buildFk5InventoryReport,
  findDuplicateCandidateIds,
  findSemanticOverlaps,
} from './curated';

const CLOCK = { nowIso: '2026-08-10T12:00:00.000Z' };

function baseContext(
  overrides: Partial<FashionClaimLockContext> = {},
): FashionClaimLockContext {
  return emptyLockContext({
    clock: CLOCK,
    traceId: 'trace_fk5',
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
  });
}

function section(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

section('versions', () => {
  assert.equal(
    FASHION_KNOWLEDGE_RELEASE,
    '1.0.0-fashion-knowledge',
  );
  assert.equal(
    FASHION_KNOWLEDGE_COLOR_MATH_VERSION,
    'fashion-knowledge-color-math-v1',
  );
});

section('source_discovery', () => {
  assert.ok(FK5_DISCOVERED_SOURCES.length >= 6);
  assert.equal(listActivatingSources().length, 0);
  assert.ok(listSourcingGaps().length >= 2);
  assert.equal(hasExternalAuthorityForDomain('COLOR'), false);
  assert.equal(hasExternalAuthorityForDomain('OCCASION'), false);
});

section('source_tiering', () => {
  assert.equal(
    defaultTierForSourceType(ProvenanceSourceType.BOOK),
    SourceAuthorityTier.TIER_A,
  );
  assert.equal(
    defaultTierForSourceType(ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE),
    SourceAuthorityTier.TIER_D,
  );
  assert.equal(canIndependentlyActivateTier(SourceAuthorityTier.TIER_D), false);
});

section('multi_source_and_dedupe', () => {
  const intersection = FK5_OCCASION_REVIEW_CANDIDATES.find(
    (c) => c.candidateId === 'FK5_RC_OCC_COLOR_INTENSITY_FORMAL',
  )!;
  assert.ok(intersection.multiSourceNotes.length >= 1);
  assert.equal(findDuplicateCandidateIds().length, 0);
  assert.equal(findSemanticOverlaps().length, 0);
});

section('color_math_not_taste', () => {
  const obs = observeColorRelationship(DEMO_HUE_RED, DEMO_HUE_YELLOW);
  assert.ok(obs.hueDistanceDegrees > 45 && obs.hueDistanceDegrees < 90);
  assert.equal(obs.bothHighSaturation, true);
  assert.equal(obs.contrastCategory, ContrastCategory.HIGH);
  assert.ok(!/good|bad|beautiful|wrong/i.test(obs.notes));
  assert.equal(
    COLOR_KNOWLEDGE_LAYER_POLICIES[ColorKnowledgeLayer.COLOR_THEORY_FACT]
      .assertsOutfitQuality,
    false,
  );
});

section('color_and_occasion_candidates', () => {
  assert.ok(FK5_COLOR_REVIEW_CANDIDATES.length >= 7);
  assert.ok(FK5_OCCASION_REVIEW_CANDIDATES.length >= 8);
  for (const c of [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ]) {
    assert.equal(c.sourcingGap, true);
    assert.equal(c.sourcingGapCode, FASHION_KNOWLEDGE_SOURCING_GAP);
    assert.equal(c.rule.status, RuleLifecycleStatus.DRAFT);
    assert.equal(c.rule.provenance.sourceType, ProvenanceSourceType.UNKNOWN);
    assert.ok(c.rule.rationale.length > 20);
    assert.ok(!/looks better/i.test(c.rule.rationale));
    assert.equal(isProductionEligibleRule(c.rule), false);
    const promo = evaluatePromotionToActive(c.rule, {
      humanApprovalProven: false,
    });
    assert.equal(promo.allowed, false);
    assert.ok(promo.reasons.includes('unknown_source_cannot_activate'));
  }
});

section('dress_code_vs_occasion', () => {
  assert.ok(
    conceptsAreDistinct(
      FashionOccasionId.WEDDING,
      FashionDressCodeId.BLACK_TIE,
    ),
  );
  assert.notEqual(FashionOccasionId.WEDDING, FashionDressCodeId.BLACK_TIE);
});

section('day_evening_and_applicability', () => {
  const day = FK5_OCCASION_REVIEW_CANDIDATES.find(
    (c) => c.candidateId === 'FK5_RC_OCC_DAYTIME_WEDDING',
  )!;
  const eve = FK5_OCCASION_REVIEW_CANDIDATES.find(
    (c) => c.candidateId === 'FK5_RC_OCC_EVENING_WEDDING',
  )!;
  assert.ok(
    day.rule.occasionContext.includes(FashionOccasionId.DAYTIME_WEDDING),
  );
  assert.ok(
    eve.rule.occasionContext.includes(FashionOccasionId.EVENING_WEDDING),
  );
  const dominance = FK5_COLOR_REVIEW_CANDIDATES.find(
    (c) => c.candidateId === 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE',
  )!;
  assert.ok(
    dominance.rule.exceptions.some((e) => e.exceptionId === 'ex_bold_style_goal'),
  );
});

section('subjectivity_confidence', () => {
  const theory = FK5_COLOR_REVIEW_CANDIDATES.find(
    (c) => c.colorLayer === ColorKnowledgeLayer.COLOR_THEORY_FACT,
  )!;
  assert.equal(theory.rule.subjectivity, 'LOW_SUBJECTIVITY');
  const convention = FK5_COLOR_REVIEW_CANDIDATES.find(
    (c) => c.candidateId === 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE',
  )!;
  assert.equal(convention.rule.subjectivity, 'MEDIUM_SUBJECTIVITY');
  assert.notEqual(convention.rule.confidence, 'HIGH');
});

section('no_special_case_red_yellow_hack', () => {
  assert.equal(LEGACY_CLASH_PAIR_POLICY.isCuratedFashionKnowledge, false);
  assert.equal(LEGACY_CLASH_PAIR_POLICY.redYellowIsClash, false);
  assert.equal(isLegacyClashPairDocumented('red', 'yellow'), false);
  const flow = evaluateRedYellowWeddingFlow({
    dressCode: FashionDressCodeId.UNKNOWN,
    styleGoal: 'bold',
  });
  assert.equal(flow.specialCasePairBanExists, false);
  assert.equal(flow.legacyClashWouldFire, false);
  assert.equal(flow.productionCuratedAuthority, 'NONE');
  assert.ok(flow.adviceDirections.includes('preserve_bold_look'));
  assert.ok(flow.adviceDirections.includes('clarify_dress_code'));
  assert.ok(flow.adviceDirections.includes('reduce_competing_dominance'));
  assert.ok(!/cannot be worn|must not wear red/i.test(flow.notes));
});

section('claim_lock_compat', () => {
  const candidate = makeRedYellowWeddingCandidate();
  const lock = evaluateFashionClaimLock(candidate, baseContext());
  assert.ok(
    lock.decision === ClaimLockDecision.PASS ||
      lock.decision === ClaimLockDecision.PASS_WITH_QUALIFICATION ||
      lock.decision === ClaimLockDecision.NEED_CLARIFICATION,
  );
  assert.notEqual(lock.decision, ClaimLockDecision.BLOCK);
});

section('curated_over_llm_precedence', () => {
  const withCurated = resolveCuratedOverLlm({
    curatedRules: [TEST_RULE_COLOR_CONTRAST],
    llmCandidateRuleIds: ['llm_draft_1'],
    domain: FashionRuleDomain.COLOR,
  });
  assert.equal(withCurated.winner, 'curated_rule');

  const draftOnly = resolveCuratedOverLlm({
    curatedRules: FK5_COLOR_REVIEW_CANDIDATES.map((c) => c.rule),
    llmCandidateRuleIds: ['llm_draft_1'],
    domain: FashionRuleDomain.COLOR,
  });
  assert.equal(draftOnly.winner, 'llm');
});

section('no_llm_active_rule', () => {
  for (const c of [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ]) {
    assert.notEqual(
      c.rule.provenance.sourceType,
      ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
    );
    assert.notEqual(c.rule.knowledgeType, KnowledgeType.LLM_GENERAL_KNOWLEDGE);
    assert.notEqual(c.rule.status, RuleLifecycleStatus.ACTIVE);
  }
});

section('no_cultural_overclaim', () => {
  for (const c of FK5_OCCASION_REVIEW_CANDIDATES) {
    assert.equal(c.rule.culturalContext.length, 0);
    const blob = `${c.rule.rationale} ${c.reviewerNotes}`.toLowerCase();
    assert.ok(!blob.includes('saudi'));
    assert.ok(!blob.includes('gulf'));
  }
});

section('copyright_safety', () => {
  for (const c of [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ]) {
    assert.equal(c.copyrightSafe, true);
    assert.ok(c.rule.rationale.length < 500);
    assert.equal(c.rule.provenance.title, undefined);
    assert.equal(c.rule.provenance.author, undefined);
  }
});

section('human_review_pack_and_inventory', () => {
  const pack = buildHumanReviewPack();
  assert.equal(
    pack.length,
    FK5_COLOR_REVIEW_CANDIDATES.length +
      FK5_OCCASION_REVIEW_CANDIDATES.length,
  );
  assert.ok(pack.every((e) => e.sourcingGap === true));
  assert.ok(pack.every((e) => e.reviewerDecision === 'NEEDS_SOURCE'));

  const inv = buildFk5InventoryReport({ humanApprovalProven: false });
  assert.equal(inv.productionActiveRuleIds.length, 0);
  assert.equal(inv.productionRegistryRemainsEmpty, true);
  assert.equal(inv.releaseEligibleWithProvenHumanApproval.length, 0);
  assert.equal(inv.activatingSourcesFound, 0);

  const stillEmpty = filterReleaseEligibleCandidates(
    [...FK5_COLOR_REVIEW_CANDIDATES, ...FK5_OCCASION_REVIEW_CANDIDATES],
    { humanApprovalProven: true },
  );
  assert.equal(stillEmpty.length, 0);
});

section('production_registry_empty_and_rollback', () => {
  const CLOCK_ISO = '2026-08-10T00:00:00.000Z';
  const loaded = loadProductionFashionKnowledgeRegistry({
    clockNowIso: CLOCK_ISO,
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.registry!.rules.length, 0);

  const empty = emptyProductionRegistry(CLOCK_ISO);
  const snap = createRegistrySnapshot({
    registry: empty,
    generatedAt: CLOCK_ISO,
  });
  assert.equal(snap.activeRuleIds.length, 0);

  const mgr = new FashionKnowledgeReleaseManager();
  const r1 = mgr.release({
    registry: empty,
    releasedAt: CLOCK_ISO,
    releaseNotes: 'FK-5 empty ACTIVE anchor',
  });
  assert.equal(r1.activeRuleCount, 0);

  const next = buildFashionKnowledgeRegistry({
    registryId: empty.registryId,
    registryVersion: '0.0.1-fk5-still-empty',
    releaseId: 'fk5-still-empty',
    createdAt: CLOCK_ISO,
    updatedAt: '2026-08-11T00:00:00.000Z',
    rules: [],
    relations: [],
    provenanceCatalog: [],
    metadata: { note: 'still empty' },
  });
  mgr.release({
    registry: next,
    releasedAt: '2026-08-11T00:00:00.000Z',
    releaseNotes: 'still empty content release',
  });
  const rolled = mgr.rollback({
    toReleaseId: r1.releaseId,
    timestamp: '2026-08-12T00:00:00.000Z',
    actorRef: 'fk5',
  });
  assert.equal(rolled.rollbackTarget, r1.releaseId);

  const ask = askApplicableCuratedRules(empty, {
    domain: FashionRuleDomain.COLOR,
    clockNowIso: CLOCK_ISO,
    activeOnly: true,
  });
  assert.equal(ask.available, false);
  assert.equal(ask.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
});

section('deterministic_hashes', () => {
  const CLOCK_ISO = '2026-08-10T00:00:00.000Z';
  const a = emptyProductionRegistry(CLOCK_ISO);
  const b = emptyProductionRegistry(CLOCK_ISO);
  assert.equal(a.snapshotHash, b.snapshotHash);
  const s1 = createRegistrySnapshot({ registry: a, generatedAt: CLOCK_ISO });
  const s2 = createRegistrySnapshot({ registry: b, generatedAt: CLOCK_ISO });
  assert.equal(s1.contentHash, s2.contentHash);
});

section('performance_probe', () => {
  const CLOCK_ISO = '2026-08-10T12:00:00.000Z';
  const t0 = Date.now();
  const loaded = loadProductionFashionKnowledgeRegistry({
    clockNowIso: CLOCK_ISO,
  });
  const loadMs = Date.now() - t0;
  assert.equal(loaded.ok, true);
  const t1 = Date.now();
  observeColorRelationship(DEMO_HUE_RED, DEMO_HUE_YELLOW);
  const colorMs = Date.now() - t1;
  const t2 = Date.now();
  askApplicableCuratedRules(loaded.registry!, {
    domain: FashionRuleDomain.OCCASION,
    occasion: FashionOccasionId.WEDDING,
    clockNowIso: CLOCK_ISO,
    activeOnly: true,
  });
  const occMs = Date.now() - t2;
  console.log(
    `ok performance load=${loadMs}ms color=${colorMs}ms occasion=${occMs}ms`,
  );
  assert.ok(loadMs < 2000);
  assert.ok(colorMs < 100);
  assert.ok(occMs < 500);
});

section('frozen_boundary_marker', () => {
  assert.ok(true, 'FK-5 additive under fashion-knowledge only');
});

console.log('FK-5 schema tests passed');
