/**
 * Phase 6E.1 + 6E.2 — Styling Intelligence tests (remediation).
 * Run: npm run test:phase6e
 */
import assert from 'node:assert/strict';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { CanonicalGarment } from './garment/canonical-garment';
import {
  fashionRuntime,
  toPublicFashionRuntime,
  assertNoFashionProviderLeakage,
} from './runtime/fashion-runtime-state';
import { CanonicalOutfit } from './outfit/canonical-outfit';
import { OutfitEvaluationEngine } from './outfit/evaluation-engine';
import { getFashionCapability } from './capability/fashion-capability-catalog';
import { FASHION_INTELLIGENCE_RELEASE, FASHION_STYLE_SCHEMA_VERSION } from './release';
import {
  FASHION_STYLING_REASONING_POLICY_VERSION,
  styleSchemaVersion,
  toPublicCanonicalStylingProfile,
} from './styling/canonical-styling-profile';
import { StylingEvaluationEngine } from './styling/evaluation-engine';
import { StylingIntelligenceService } from './styling/styling-intelligence.service';
import {
  assertValidStylingProfileLaw32,
  validateCanonicalStylingProfile,
} from './styling/styling-validators';
import { EvidenceInterpretationEngine } from './styling/evidence-interpretation-engine';
import { STYLING_MAPPING_EPOCH_ISO } from './styling/styling-identity';
import { STYLING_DECISION_PRIORITY_BAND } from './styling/reasoning-engine';
import {
  evolveMemorySnapshot,
  emptyStyleMemory,
  StyleMemoryStore,
} from './styling/style-memory';
import { citesFrozenEvidence } from './styling/law32-frozen-evidence';

function fakeConfig(overrides: Record<string, string> = {}): NestConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as NestConfigService;
}

function sampleGarment(
  overrides: Partial<CanonicalGarment> & { garmentId: string },
): CanonicalGarment {
  const runtime = toPublicFashionRuntime(
    fashionRuntime({
      status: 'AVAILABLE',
      stage: 'mapping',
      reasonCode: 'fixture',
      capabilityId: 'analyze_garment',
      capabilityVersion: 'garment-schema-v1',
      traceId: 'fix',
    }),
  );
  const base: CanonicalGarment = {
    garmentId: overrides.garmentId,
    version: 'garment-schema-v1',
    identity: {
      categoryId: 'tops',
      typeId: 'blouse',
      entityClass: 'garment',
    },
    attributes: {
      colors: ['white'],
      material: { kind: 'estimated', value: 'cotton' },
      season: ['spring'],
      occasion: ['casual'],
      styleHints: ['minimal'],
    },
    confidence: 0.8,
    fieldConfidence: [{ field: 'color:white', confidence: 0.8 }],
    availability: 'detected',
    source: 'vision',
    limitations: [],
    explainability: [],
    runtime,
    mappingVersion: 'garment-mapping-v1',
    createdAt: STYLING_MAPPING_EPOCH_ISO,
    updatedAt: STYLING_MAPPING_EPOCH_ISO,
  };
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    attributes: { ...base.attributes, ...overrides.attributes },
  };
}

function completeLook(): { garments: CanonicalGarment[]; outfit: CanonicalOutfit } {
  const garments = [
    sampleGarment({
      garmentId: 'garm_shirt',
      identity: { categoryId: 'tops', typeId: 'shirt', entityClass: 'garment' },
    }),
    sampleGarment({
      garmentId: 'garm_jeans',
      identity: { categoryId: 'bottoms', typeId: 'jeans', entityClass: 'garment' },
      attributes: {
        colors: ['indigo'],
        material: { kind: 'estimated', value: 'denim' },
        season: ['spring'],
        occasion: ['casual'],
        styleHints: ['minimal'],
      },
    }),
  ];
  const { outfit } = new OutfitEvaluationEngine().evaluate(garments, {
    occasionId: 'casual',
    season: 'spring',
  });
  return { garments, outfit };
}

function testVersions(): void {
  assert.equal(FASHION_STYLE_SCHEMA_VERSION, 'style-schema-v1');
  assert.equal(styleSchemaVersion(), 'style-schema-v1');
  assert.equal(
    FASHION_INTELLIGENCE_RELEASE,
    '1.0.0-styling-intelligence',
  );
  assert.equal(
    FASHION_STYLING_REASONING_POLICY_VERSION,
    'styling-reasoning-policy-v1',
  );
  console.log('ok versions');
}

function testCapabilities(): void {
  assert.equal(getFashionCapability('analyze_style')?.executionEnabled, true);
  assert.equal(getFashionCapability('recommendations')?.executionEnabled, false);
  console.log('ok capabilities');
}

function testLaw32GoalBlockedWithoutFrozen(): void {
  const { profile, decisionLedger, interpretedEvidence } =
    new StylingEvaluationEngine().evaluate({
      subjectId: 'user_law32',
      skin: { reportId: 'skin_only', confidence: 0.9 },
      goalDrafts: [
        {
          titleEn: 'Aspire',
          titleAr: 'طموح',
          target: 'aspire_elegance',
        },
      ],
    });
  // Skin is frozen — goal may be active with skin evidence
  assert.ok(profile.goals.length >= 1);
  for (const g of profile.goals) {
    if (g.status === 'active') {
      assert.ok(citesFrozenEvidence(g.evidenceRefs, interpretedEvidence));
    }
  }
  for (const d of profile.decisions) {
    assert.ok(citesFrozenEvidence(d.evidenceRefs, interpretedEvidence));
  }
  assertValidStylingProfileLaw32(profile, decisionLedger, interpretedEvidence);

  // No frozen at all — goal blocked, no fabricated decision
  const empty = new StylingEvaluationEngine().evaluate({
    subjectId: 'user_nofrozen',
    goalDrafts: [
      { titleEn: 'X', titleAr: 'س', target: 'aspire_only_draft' },
    ],
  });
  assert.ok(empty.profile.goals.every((g) => g.status === 'blocked'));
  assert.ok(
    empty.profile.limitations.some(
      (l) => l.includes('blocked_goal') || l.includes('missing_evidence'),
    ),
  );
  assert.ok(
    !empty.profile.decisions.some((d) =>
      d.claim.includes('aspire_only_draft'),
    ),
  );
  console.log('ok law32_goals');
}

function testLaw32NoGoalDraftOnlyDecision(): void {
  const { garments, outfit } = completeLook();
  const { profile, interpretedEvidence } = new StylingEvaluationEngine().evaluate(
    {
      subjectId: 'user_ok',
      garments,
      outfits: [outfit],
      wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
      goalDrafts: [
        { titleEn: 'Capsule', titleAr: 'كبسولة', target: 'capsule_basics' },
      ],
    },
  );
  for (const d of profile.decisions) {
    const kinds = d.evidenceRefs
      .map(
        (id) =>
          interpretedEvidence.find((e) => e.evidenceId === id)?.sourceKind,
      )
      .filter(Boolean);
    assert.ok(
      kinds.some((k) =>
        ['skin', 'face', 'garment', 'outfit', 'wardrobe'].includes(k as string),
      ),
      d.claim,
    );
  }
  console.log('ok law32_no_draft_only');
}

function testReasoningAndDecisions(): void {
  const { garments, outfit } = completeLook();
  const { profile, decisionLedger, interpretedEvidence } =
    new StylingEvaluationEngine().evaluate({
      subjectId: 'user_1',
      skin: { reportId: 'skin_1', confidence: 0.9 },
      face: { reportId: 'face_1', confidence: 0.85 },
      garments,
      outfits: [outfit],
      wardrobe: { garmentIds: ['garm_shirt', 'garm_jeans'] },
      memory: {
        ...emptyStyleMemory(),
        preferredColors: ['white'],
        favoriteOutfitIds: [outfit.outfitId],
        sessionIds: ['sess_1'],
      },
    });
  assert.ok(profile.decisions.length >= 1);
  assert.ok(profile.fieldConfidence.some((f) => f.field === 'overall'));
  assert.equal(decisionLedger.entries.length, profile.decisions.length);
  assertValidStylingProfileLaw32(profile, decisionLedger, interpretedEvidence);
  console.log('ok reasoning_decisions');
}

function testPriorityPolicy(): void {
  assert.ok(
    STYLING_DECISION_PRIORITY_BAND.preference_conflict <
      STYLING_DECISION_PRIORITY_BAND.outfit_supports_styling_direction,
  );
  assert.ok(
    STYLING_DECISION_PRIORITY_BAND.wardrobe_refs_interpreted <
      STYLING_DECISION_PRIORITY_BAND.goal_active,
  );
  const { garments, outfit } = completeLook();
  garments[0] = sampleGarment({
    garmentId: 'garm_shirt',
    attributes: {
      colors: ['neon'],
      material: { kind: 'unknown' },
      season: [],
      occasion: [],
      styleHints: ['maximal'],
    },
  });
  const { outfit: o2 } = new OutfitEvaluationEngine().evaluate(garments);
  const { profile } = new StylingEvaluationEngine().evaluate({
    subjectId: 'user_pri',
    garments,
    outfits: [o2],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    memory: {
      ...emptyStyleMemory(),
      dislikedStyleTags: ['maximal'],
    },
  });
  const claims = profile.decisions.map((d) => d.claim);
  const conflictIdx = claims.findIndex((c) => c.startsWith('preference_conflict'));
  const wardrobeIdx = claims.findIndex((c) => c.startsWith('wardrobe_refs'));
  if (conflictIdx >= 0 && wardrobeIdx >= 0) {
    assert.ok(conflictIdx < wardrobeIdx, 'conflict before wardrobe');
  }
  console.log('ok priority_policy');
}

function testProgressEvidence(): void {
  const { garments, outfit } = completeLook();
  const { profile, interpretedEvidence } = new StylingEvaluationEngine().evaluate({
    subjectId: 'user_prog',
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
  });
  for (const delta of profile.progress.deltas) {
    assert.ok(delta.evidenceRefs.length > 0);
    assert.ok(citesFrozenEvidence(delta.evidenceRefs, interpretedEvidence));
  }
  console.log('ok progress_evidence');
}

function testImpossibleGoal(): void {
  const { profile } = new StylingEvaluationEngine().evaluate({
    subjectId: 'user_goal',
    skin: { reportId: 'skin_x', confidence: 0.7 },
    goalDrafts: [
      {
        titleEn: 'Complete look',
        titleAr: 'إطلالة مكتملة',
        target: 'complete_look_from_wardrobe',
      },
    ],
    wardrobe: { garmentIds: [] },
  });
  assert.ok(profile.goals.some((g) => g.status === 'blocked'));
  console.log('ok impossible_goal');
}

function testDeterminismAndTrace(): void {
  const { garments, outfit } = completeLook();
  const input = {
    subjectId: 'user_det',
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: ['garm_jeans', 'garm_shirt'] },
    skin: { reportId: 'skin_1', confidence: 0.9 },
  };
  const eng = new StylingEvaluationEngine();
  const a = eng.evaluate(input);
  const b = eng.evaluate({ ...input, garments: [...garments].reverse() });
  assert.equal(a.profile.styleProfileId, b.profile.styleProfileId);
  assert.equal(a.profile.runtime.traceId, b.profile.runtime.traceId);
  assert.equal(a.profile.confidence, b.profile.confidence);

  const svc = new StylingIntelligenceService(fakeConfig());
  const s = svc.analyzeStyle(input);
  assert.equal(s.profile.runtime.traceId, a.profile.runtime.traceId);
  assert.equal(s.profile.styleProfileId, a.profile.styleProfileId);
  console.log('ok determinism_trace');
}

function testLedgerBijection(): void {
  const { garments, outfit } = completeLook();
  const { profile, decisionLedger, interpretedEvidence } =
    new StylingEvaluationEngine().evaluate({
      subjectId: 'user_led',
      garments,
      outfits: [outfit],
      wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    });
  const dIds = new Set(profile.decisions.map((d) => d.decisionId));
  const lIds = new Set(decisionLedger.entries.map((e) => e.decisionId));
  assert.deepEqual([...dIds].sort(), [...lIds].sort());
  assertValidStylingProfileLaw32(profile, decisionLedger, interpretedEvidence);
  const pub = toPublicCanonicalStylingProfile(profile);
  assert.equal(
    (pub as { decisionLedgerRef?: string }).decisionLedgerRef,
    undefined,
  );
  console.log('ok ledger_bijection');
}

function testMemoryIsolation(): void {
  const svc = new StylingIntelligenceService(fakeConfig());
  const { garments, outfit } = completeLook();
  const a = svc.analyzeStyle({
    subjectId: 'user_a',
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    sessionId: 'sess_a',
    memory: { ...emptyStyleMemory(), preferredColors: ['red'] },
  });
  const b = svc.analyzeStyle({
    subjectId: 'user_b',
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    sessionId: 'sess_b',
    memory: { ...emptyStyleMemory(), preferredColors: ['blue'] },
  });
  assert.deepEqual(a.memorySnapshot.preferredColors, ['red']);
  assert.deepEqual(b.memorySnapshot.preferredColors, ['blue']);
  assert.ok(!a.memorySnapshot.sessionIds.includes('sess_b'));
  assert.ok(!b.memorySnapshot.sessionIds.includes('sess_a'));

  // Ephemeral store helper does not share across instances
  const s1 = new StyleMemoryStore();
  const s2 = new StyleMemoryStore();
  s1.load({ ...emptyStyleMemory(), preferredColors: ['x'] });
  assert.deepEqual(s2.getSnapshot().preferredColors, []);

  const evolved = evolveMemorySnapshot({
    prior: emptyStyleMemory(),
    decisions: a.profile.decisions,
    sessionId: 'sess_z',
  });
  assert.ok(evolved.sessionIds.includes('sess_z'));
  console.log('ok memory_isolation');
}

function testValidationNegative(): void {
  const { garments, outfit } = completeLook();
  const { profile, decisionLedger, interpretedEvidence } =
    new StylingEvaluationEngine().evaluate({
      subjectId: 'user_val',
      garments,
      outfits: [outfit],
      wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    });
  const rogue = {
    ...profile,
    decisions: [
      ...profile.decisions,
      {
        ...profile.decisions[0]!,
        decisionId: 'sdec_rogue',
        evidenceRefs: [],
      },
    ],
  };
  const v = validateCanonicalStylingProfile(
    rogue,
    decisionLedger,
    interpretedEvidence,
  );
  assert.equal(v.valid, false);
  assert.ok(v.issues.some((i) => i.code === 'decision_without_evidence'));
  console.log('ok validation_negative');
}

function testService(): void {
  const svc = new StylingIntelligenceService(fakeConfig());
  const { garments, outfit } = completeLook();
  const out = svc.analyzeStyle({
    subjectId: 'user_svc',
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
    skin: { reportId: 'skin_1', confidence: 0.9 },
  });
  assert.equal(out.capabilityId, 'analyze_style');
  assertNoFashionProviderLeakage(out.profile);
  assert.ok(out.memorySnapshot);
  const off = new StylingIntelligenceService(
    fakeConfig({ FASHION_STYLING_INTEL_ENABLED: 'false' }),
  );
  assert.throws(() =>
    off.analyzeStyle({ subjectId: 'x', garments, outfits: [outfit] }),
  );
  console.log('ok service');
}

function testGoldenRegression(): void {
  const garments = [
    sampleGarment({ garmentId: 'garm_base' }),
    sampleGarment({
      garmentId: 'garm_lower',
      identity: { categoryId: 'bottoms', typeId: 'skirt', entityClass: 'garment' },
    }),
  ];
  const { outfit } = new OutfitEvaluationEngine().evaluate(garments, {
    occasionId: 'casual',
  });
  const { profile, decisionLedger, interpretedEvidence } =
    new StylingEvaluationEngine().evaluate({
      subjectId: 'golden_user',
      skin: { reportId: 'skin_golden', confidence: 0.88 },
      face: { reportId: 'face_golden', confidence: 0.9 },
      garments,
      outfits: [outfit],
      wardrobe: {
        garmentIds: ['garm_base', 'garm_lower'],
        favoriteOutfitIds: [outfit.outfitId],
      },
      goalDrafts: [
        {
          titleEn: 'Build capsule',
          titleAr: 'بناء كبسولة',
          target: 'capsule_basics',
        },
      ],
    });
  assert.ok(profile.styleProfileId.startsWith('style_'));
  assertValidStylingProfileLaw32(profile, decisionLedger, interpretedEvidence);
  console.log('ok golden_regression');
}

function testEvidenceInterpretation(): void {
  const { garments, outfit } = completeLook();
  const { evidence } = new EvidenceInterpretationEngine().interpret({
    subjectId: 'user_1',
    skin: { reportId: 'skin_1', confidence: 0.9 },
    garments,
    outfits: [outfit],
    wardrobe: { garmentIds: garments.map((g) => g.garmentId) },
  });
  assert.ok(evidence.some((e) => e.sourceKind === 'outfit'));
  console.log('ok evidence_interpretation');
}

async function main(): Promise<void> {
  testVersions();
  testCapabilities();
  testEvidenceInterpretation();
  testLaw32GoalBlockedWithoutFrozen();
  testLaw32NoGoalDraftOnlyDecision();
  testReasoningAndDecisions();
  testPriorityPolicy();
  testProgressEvidence();
  testImpossibleGoal();
  testDeterminismAndTrace();
  testLedgerBijection();
  testMemoryIsolation();
  testValidationNegative();
  testService();
  testGoldenRegression();
  console.log('phase6e.3 styling intelligence freeze OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
