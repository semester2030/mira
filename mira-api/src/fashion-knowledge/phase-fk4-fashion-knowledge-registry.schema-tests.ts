/**
 * FK-4 — Fashion Knowledge Registry foundation tests.
 * Run: npm run test:fk4
 *
 * Empty production registry · TEST_ONLY fixtures · no LLM writes · no public API.
 */
import assert from 'node:assert/strict';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_REGISTRY_VERSION,
  FASHION_KNOWLEDGE_SNAPSHOT_VERSION,
  FASHION_KNOWLEDGE_LOOKUP_VERSION,
  FASHION_KNOWLEDGE_AUDIT_VERSION,
  FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION,
} from './versioning/release';
import {
  ConditionField,
  ConditionOperator,
} from './contracts/conditions';
import { FashionRuleDomain } from './contracts/rule-domains';
import { KnowledgeConfidence } from './contracts/confidence';
import { KnowledgeType } from './contracts/knowledge-types';
import { SubjectivityLevel } from './contracts/subjectivity';
import {
  evaluateCondition,
  evaluateAllConditions,
} from './registry/condition-evaluator';
import {
  buildFk4TestRegistry,
  buildCircularSupersessionRegistry,
  FK4_TEST_RULE_COLOR,
  FK4_TEST_RULE_OCCASION,
  FK4_TEST_RULE_EXCEPTION,
  FK4_TEST_RULE_OLD,
  FK4_TEST_RULE_NEW,
  FK4_TEST_RULE_DRAFT,
} from './registry/fixtures';
import {
  validateFashionKnowledgeRegistry,
} from './registry/validation';
import {
  buildFashionKnowledgeRegistry,
  createRegistrySnapshot,
  computeRegistryContentHash,
} from './registry/snapshot';
import {
  lookupFashionKnowledgeRules,
  hashLookupQuery,
  askApplicableCuratedRules,
} from './registry/lookup';
import { LookupReasonCode } from './registry/contracts';
import { analyzeSupersession } from './registry/supersession';
import {
  emptyProductionRegistry,
  InMemoryFashionKnowledgeRegistryStore,
} from './registry/storage';
import {
  loadProductionFashionKnowledgeRegistry,
  clearRegistryCache,
} from './registry/loader';
import { FashionKnowledgeReleaseManager } from './registry/release';
import {
  assertNoLlmRegistryWriteApi,
  asReadOnlyRegistryPort,
  LLM_REGISTRY_WRITE_FORBIDDEN,
} from './registry/llm-write-guard';
import { checkRuleClaimLockCompatibility } from './registry/claim-lock-compat';
import { isFashionKnowledgeRegistryEnabled } from './registry/feature-flag';
import { probeRegistryPerformance } from './registry/performance';
import { runFashionKnowledgeLlm } from './llm/orchestrator';
import { MockFashionKnowledgeLlmProvider } from './llm/mock-provider';
import { FASHION_LLM_REQUEST_VERSION } from './versioning/release';
import { FashionAdviceType } from './contracts/advice-types';

const CLOCK = '2026-08-10T12:00:00.000Z';

function testVersions(): void {
  assert.equal(FASHION_KNOWLEDGE_RELEASE, '1.0.0-fashion-knowledge');
  assert.equal(
    FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
    'fashion-knowledge-registry-schema-v1',
  );
  assert.equal(FASHION_KNOWLEDGE_REGISTRY_VERSION, 'fashion-knowledge-registry-v1');
  assert.equal(FASHION_KNOWLEDGE_SNAPSHOT_VERSION, 'fashion-knowledge-snapshot-v1');
  assert.equal(FASHION_KNOWLEDGE_LOOKUP_VERSION, 'fashion-knowledge-lookup-v1');
  assert.equal(FASHION_KNOWLEDGE_AUDIT_VERSION, 'fashion-knowledge-audit-v1');
  assert.equal(
    FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION,
    'fashion-knowledge-release-v1',
  );
  console.log('ok versions');
}

function testEmptyRegistry(): void {
  const empty = emptyProductionRegistry(CLOCK);
  assert.equal(empty.rules.length, 0);
  const v = validateFashionKnowledgeRegistry(empty, {
    productionMode: true,
    allowTestOnly: false,
  });
  assert.equal(v.ok, true);
  const lookup = lookupFashionKnowledgeRules(empty, {
    clockNowIso: CLOCK,
    colorFacts: ['red'],
  });
  assert.equal(lookup.matchedRules.length, 0);
  assert.ok(
    lookup.reasonCodes.includes(LookupReasonCode.NO_APPLICABLE_CURATED_RULE),
  );
  console.log('ok empty_registry');
}

function testValidTestRegistry(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const v = validateFashionKnowledgeRegistry(reg, {
    allowTestOnly: true,
    productionMode: false,
  });
  assert.equal(v.ok, true, JSON.stringify(v.issues));
  assert.ok(reg.indexes.byDomain.COLOR?.includes(FK4_TEST_RULE_COLOR.ruleId));
  console.log('ok valid_test_registry');
}

function testDuplicateIds(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const bad = buildFashionKnowledgeRegistry({
    registryId: 'dup',
    registryVersion: 'x',
    releaseId: 'x',
    createdAt: CLOCK,
    updatedAt: CLOCK,
    rules: [FK4_TEST_RULE_COLOR, { ...FK4_TEST_RULE_COLOR }],
    provenanceCatalog: reg.provenanceCatalog,
    metadata: { allowTestOnly: true },
  });
  const v = validateFashionKnowledgeRegistry(bad, { allowTestOnly: true });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.code === 'duplicate_rule_id'));
  console.log('ok duplicate_ids');
}

function testLifecycleAndActiveProvenance(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const draftLookup = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    activeOnly: true,
    domain: FashionRuleDomain.GENERAL_STYLING,
  });
  assert.ok(
    draftLookup.excludedRules.some(
      (e) =>
        e.ruleId === FK4_TEST_RULE_DRAFT.ruleId &&
        e.reasonCode === LookupReasonCode.INACTIVE,
    ),
  );

  const activeBad = buildFashionKnowledgeRegistry({
    registryId: 'bad_active',
    registryVersion: '1',
    releaseId: '1',
    createdAt: CLOCK,
    updatedAt: CLOCK,
    rules: [
      {
        ...FK4_TEST_RULE_COLOR,
        ruleId: 'BAD_ACTIVE_LLM',
        knowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
        provenance: {
          ...FK4_TEST_RULE_COLOR.provenance,
          sourceType: 'llm_general_knowledge' as const,
          approvalStatus: 'UNCURATED' as const,
        },
      },
    ],
    metadata: { allowTestOnly: true },
  });
  const v = validateFashionKnowledgeRegistry(activeBad, { allowTestOnly: true });
  assert.equal(v.ok, false);
  assert.ok(
    v.issues.some(
      (i) =>
        i.code === 'active_invalid_provenance' ||
        i.code === 'active_llm_knowledge' ||
        i.code === 'active_without_approval',
    ),
  );
  console.log('ok lifecycle_provenance');
}

function testSupersessionAndConflicts(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const analysis = analyzeSupersession(reg.relations);
  assert.equal(analysis.valid, true);
  assert.ok(analysis.supersededRuleIds.has(FK4_TEST_RULE_OLD.ruleId));

  const lookup = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
    domain: FashionRuleDomain.COLOR,
  });
  assert.ok(
    lookup.excludedRules.some(
      (e) =>
        e.ruleId === FK4_TEST_RULE_OLD.ruleId &&
        e.reasonCode === LookupReasonCode.SUPERSEDED,
    ),
  );
  assert.ok(lookup.matchedRules.some((m) => m.ruleId === FK4_TEST_RULE_NEW.ruleId));
  assert.ok(lookup.conflictRefs.length >= 1);

  const cycle = buildCircularSupersessionRegistry(CLOCK);
  const cv = validateFashionKnowledgeRegistry(cycle, { allowTestOnly: true });
  assert.equal(cv.ok, false);
  assert.ok(cv.issues.some((i) => i.code === 'circular_supersession'));
  console.log('ok supersession_conflicts');
}

function testExceptionPrecedence(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const hit = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    colorFacts: ['red'],
    garmentFacts: { color: ['red', 'yellow'], preference: 'bold' },
    preferenceTokens: ['bold'],
    domain: FashionRuleDomain.COLOR,
  });
  assert.ok(
    hit.excludedRules.some(
      (e) =>
        e.ruleId === FK4_TEST_RULE_EXCEPTION.ruleId &&
        e.reasonCode === LookupReasonCode.EXCEPTION_MATCHED,
    ),
  );
  console.log('ok exception_precedence');
}

function testTrendExpiryAndClock(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const expired = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
    knowledgeTypes: [KnowledgeType.TREND],
  });
  assert.ok(
    expired.excludedRules.some(
      (e) => e.reasonCode === LookupReasonCode.TREND_EXPIRED,
    ),
  );
  const inWindow = lookupFashionKnowledgeRules(reg, {
    clockNowIso: '2020-06-01T00:00:00.000Z',
    allowTestOnly: true,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
    knowledgeTypes: [KnowledgeType.TREND],
  });
  assert.ok(inWindow.matchedRules.some((m) => m.ruleId.includes('TREND')));
  console.log('ok trend_clock');
}

function testOccasionMatchMismatch(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const miss = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    domain: FashionRuleDomain.OCCASION,
  });
  assert.ok(
    miss.excludedRules.some(
      (e) =>
        e.ruleId === FK4_TEST_RULE_OCCASION.ruleId &&
        e.reasonCode === LookupReasonCode.OCCASION_MISMATCH,
    ),
  );
  const hit = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    domain: FashionRuleDomain.OCCASION,
    occasion: 'wedding',
    garmentFacts: { occasion: 'wedding' },
  });
  assert.ok(
    hit.matchedRules.some((m) => m.ruleId === FK4_TEST_RULE_OCCASION.ruleId),
  );
  console.log('ok occasion');
}

function testConditionOperators(): void {
  const facts = {
    color: 'red',
    score: 5,
    tags: ['a', 'b'],
    missing: undefined,
  };
  assert.equal(
    evaluateCondition(
      { field: ConditionField.COLOR, operator: ConditionOperator.EQUALS, value: 'red' },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.NOT_EQUALS,
        value: 'blue',
      },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.IN,
        value: ['red', 'yellow'],
      },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.NOT_IN,
        value: ['blue'],
      },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      { field: ConditionField.COLOR, operator: ConditionOperator.EXISTS },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.MATERIAL,
        operator: ConditionOperator.NOT_EXISTS,
      },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.CONTAINS,
        value: 'red',
      },
      { color: ['red', 'yellow'] },
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.ANY_OF,
        value: ['yellow', 'red'],
      },
      facts,
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.ALL_OF,
        value: ['red'],
      },
      { color: ['red', 'yellow'] },
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.FORMALITY,
        operator: ConditionOperator.RANGE,
        value: { min: 1, max: 10 },
      },
      { formality: 5 },
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.FORMALITY,
        operator: ConditionOperator.GREATER_THAN,
        value: 3,
      },
      { formality: 5 },
    ).matched,
    true,
  );
  assert.equal(
    evaluateCondition(
      {
        field: ConditionField.FORMALITY,
        operator: ConditionOperator.LESS_THAN,
        value: 9,
      },
      { formality: 5 },
    ).matched,
    true,
  );
  const failClosed = evaluateCondition(
    {
      field: ConditionField.COLOR,
      operator: ConditionOperator.RANGE,
      value: 'nope' as unknown as { min: number; max: number },
    },
    facts,
  );
  assert.equal(failClosed.ok, false);
  assert.equal(
    evaluateAllConditions(
      [
        {
          field: ConditionField.COLOR,
          operator: ConditionOperator.EQUALS,
          value: 'red',
        },
      ],
      facts,
    ).matched,
    true,
  );
  console.log('ok condition_operators');
}

function testDeterministicHashes(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const q1 = {
    clockNowIso: CLOCK,
    colorFacts: ['yellow', 'red'],
    preferenceTokens: ['statement', 'bold'],
    allowTestOnly: true,
  };
  const q2 = {
    clockNowIso: CLOCK,
    colorFacts: ['red', 'yellow'],
    preferenceTokens: ['bold', 'statement'],
    allowTestOnly: true,
  };
  assert.equal(hashLookupQuery(q1), hashLookupQuery(q2));

  const s1 = createRegistrySnapshot({ registry: reg, generatedAt: CLOCK });
  const s2 = createRegistrySnapshot({ registry: reg, generatedAt: CLOCK });
  assert.equal(s1.snapshotId, s2.snapshotId);
  assert.equal(s1.contentHash, s2.contentHash);
  assert.equal(
    s1.contentHash,
    computeRegistryContentHash({
      registryVersion: reg.registryVersion,
      rules: reg.rules,
      relations: reg.relations,
      provenanceCatalog: reg.provenanceCatalog,
    }),
  );

  const a = lookupFashionKnowledgeRules(reg, q1);
  const b = lookupFashionKnowledgeRules(reg, q2);
  assert.equal(a.queryHash, b.queryHash);
  assert.deepEqual(
    a.matchedRules.map((m) => m.ruleId),
    b.matchedRules.map((m) => m.ruleId),
  );
  console.log('ok determinism');
}

function testReleaseRollback(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const mgr = new FashionKnowledgeReleaseManager();
  const r1 = mgr.release({
    registry: reg,
    releasedAt: CLOCK,
    releaseNotes: 'test release',
    approvedBy: 'tester',
  });
  assert.equal(r1.registryVersion, reg.registryVersion);
  assert.ok(mgr.getSnapshot(r1.snapshotId));

  const empty = emptyProductionRegistry(CLOCK);
  const r2 = mgr.release({
    registry: empty,
    releasedAt: '2026-08-11T00:00:00.000Z',
    releaseNotes: 'empty',
  });
  const rolled = mgr.rollback({
    toReleaseId: r1.releaseId,
    timestamp: '2026-08-12T00:00:00.000Z',
    actorRef: 'tester',
  });
  assert.ok(rolled.releaseNotes.includes('Rollback'));
  assert.ok(mgr.getAudit().list().length >= 3);
  assert.ok(r2.releaseId);
  console.log('ok release_rollback');
}

function testProductionLoader(): void {
  clearRegistryCache();
  const loaded = loadProductionFashionKnowledgeRegistry({
    clockNowIso: CLOCK,
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.registry?.rules.length, 0);
  assert.ok(
    loaded.status === 'EMPTY' || loaded.registry?.rules.length === 0,
  );
  console.log('ok production_loader');
}

function testMalformedAndSecurity(): void {
  const { writeFileSync, unlinkSync, mkdtempSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'fk4-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{not-json');
  const malformed = loadProductionFashionKnowledgeRegistry({
    filePath: bad,
    clockNowIso: CLOCK,
  });
  assert.equal(malformed.ok, false);
  assert.ok(malformed.issues.some((i) => i.code === 'malformed_json'));

  const leak = join(dir, 'leak.json');
  writeFileSync(
    leak,
    JSON.stringify({
      registryId: 'x',
      registryVersion: '1',
      releaseId: '1',
      createdAt: CLOCK,
      updatedAt: CLOCK,
      rules: [],
      metadata: { allowTestOnly: true },
    }),
  );
  const leaked = loadProductionFashionKnowledgeRegistry({
    filePath: leak,
    clockNowIso: CLOCK,
  });
  assert.equal(leaked.ok, false);
  assert.ok(leaked.issues.some((i) => i.code === 'test_only_leakage'));
  try {
    unlinkSync(bad);
    unlinkSync(leak);
  } catch {
    /* ignore */
  }
  console.log('ok security_loader');
}

async function testNoLlmWrite(): Promise<void> {
  assert.equal(LLM_REGISTRY_WRITE_FORBIDDEN, true);
  const store = new InMemoryFashionKnowledgeRegistryStore(
    emptyProductionRegistry(CLOCK),
  );
  const read = asReadOnlyRegistryPort(store);
  assertNoLlmRegistryWriteApi(read);
  assert.throws(() =>
    assertNoLlmRegistryWriteApi({ saveDraftRegistry: async () => undefined }),
  );

  // FK-3 path does not write registry
  const result = await runFashionKnowledgeLlm({
    request: {
      requestId: 'r',
      garmentFacts: [{ garmentId: 'g1', colors: ['red'] }],
      evidenceRefs: ['ev1'],
      existingKnowledgeRuleRefs: [],
      allowedAdviceTypes: [FashionAdviceType.BALANCE_COLOR],
      forbiddenClaims: [],
      locale: 'ar',
      schemaVersion: FASHION_LLM_REQUEST_VERSION,
      traceId: 't',
      clockNowIso: CLOCK,
    },
    provider: new MockFashionKnowledgeLlmProvider('valid'),
    enabled: true,
  });
  assert.ok(result);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'saveDraftRegistry'),
    false,
  );
  console.log('ok no_llm_write');
}

function testClaimLockCompat(): void {
  const compat = checkRuleClaimLockCompatibility(FK4_TEST_RULE_COLOR);
  assert.equal(compat.ok, true);
  console.log('ok claim_lock_compat');
}

function testFk3BoundaryAsk(): void {
  const empty = emptyProductionRegistry(CLOCK);
  const avail = askApplicableCuratedRules(empty, {
    clockNowIso: CLOCK,
    colorFacts: ['red'],
  });
  assert.equal(avail.available, false);
  assert.equal(avail.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);

  const reg = buildFk4TestRegistry(CLOCK);
  const hit = askApplicableCuratedRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
    domain: FashionRuleDomain.COLOR,
  });
  assert.equal(hit.available, true);
  console.log('ok fk3_boundary');
}

function testFlagAndPerf(): void {
  assert.equal(
    isFashionKnowledgeRegistryEnabled(() => undefined),
    false,
  );
  const p100 = probeRegistryPerformance(100, CLOCK);
  const p1000 = probeRegistryPerformance(1000, CLOCK);
  assert.equal(p100.ruleCount, 100);
  assert.equal(p1000.ruleCount, 1000);
  assert.ok(p100.lookupMs >= 0);
  assert.ok(p1000.indexBuildMs >= 0);
  // Soft ceiling — CI variance; ensure completes under 5s for 1k
  assert.ok(p1000.lookupMs < 5000, `lookup too slow: ${p1000.lookupMs}`);
  console.log(
    `ok performance 100={idx:${p100.indexBuildMs}ms,look:${p100.lookupMs}ms} 1000={idx:${p1000.indexBuildMs}ms,look:${p1000.lookupMs}ms matched:${p1000.matched}}`,
  );
}

function testConfidenceSubjectivityFilters(): void {
  const reg = buildFk4TestRegistry(CLOCK);
  const low = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    minimumConfidence: KnowledgeConfidence.HIGH,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
  });
  assert.ok(
    low.excludedRules.some(
      (e) => e.reasonCode === LookupReasonCode.CONFIDENCE_BELOW_THRESHOLD,
    ),
  );
  const sub = lookupFashionKnowledgeRules(reg, {
    clockNowIso: CLOCK,
    allowTestOnly: true,
    subjectivityLevels: [SubjectivityLevel.USER_DEPENDENT],
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
  });
  assert.ok(
    sub.excludedRules.some(
      (e) => e.reasonCode === LookupReasonCode.FILTERED_BY_SUBJECTIVITY,
    ) || sub.matchedRules.length === 0,
  );
  console.log('ok confidence_subjectivity');
}

function testNoPublicApiMarker(): void {
  assert.ok(typeof lookupFashionKnowledgeRules === 'function');
  assert.ok(!String(lookupFashionKnowledgeRules).includes('@Controller'));
  console.log('ok no_public_api');
}

async function main(): Promise<void> {
  testVersions();
  testEmptyRegistry();
  testValidTestRegistry();
  testDuplicateIds();
  testLifecycleAndActiveProvenance();
  testSupersessionAndConflicts();
  testExceptionPrecedence();
  testTrendExpiryAndClock();
  testOccasionMatchMismatch();
  testConditionOperators();
  testDeterministicHashes();
  testReleaseRollback();
  testProductionLoader();
  testMalformedAndSecurity();
  await testNoLlmWrite();
  testClaimLockCompat();
  testFk3BoundaryAsk();
  testFlagAndPerf();
  testConfidenceSubjectivityFilters();
  testNoPublicApiMarker();
  console.log('FK-4 schema tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
