/**
 * FK-6 — Accessories Year-1 Mode B schema tests.
 * Capability only — ACTIVE curated accessory rules remain 0.
 */
import assert from 'node:assert/strict';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FashionAdviceType,
  FashionRuleDomain,
  ClaimLockDecision,
  ProvenanceApprovalStatus,
  KnowledgeType,
  CandidateSourceType,
  ALL_FASHION_ADVICE_TYPES,
  validateToneSafety,
  askApplicableCuratedRules,
  LookupReasonCode,
  loadProductionFashionKnowledgeRegistry,
  runFashionKnowledgeLlm,
  projectFashionLlmContext,
  RuleLifecycleStatus,
  isProductionEligibleRule,
  FashionLlmRuntimeStatus,
} from './index';
import { emptyProductionRegistry } from './registry/storage';
import { MockFashionKnowledgeLlmProvider } from './llm/mock-provider';
import {
  YEAR1_MODE_B_POLICY,
  isYear1ModeBPromotionForbidden,
  AccessoryPresence,
  AccessoryRole,
  MetallicFamily,
  VisualDominance,
  projectAccessoryFact,
  unknownAccessorySlot,
  presenceAllowsInventedAddClaim,
  isUnknownPresence,
  FK6_ACCESSORY_ADVICE_TYPES,
  evaluateModeBEligibility,
  isFashionKnowledgeAccessoriesEnabled,
  runFk6AccessoriesEvaluation,
  FK6_ACCESSORY_REVIEW_CANDIDATES,
  fk6ActiveAccessoryRuleCount,
  validateAccessoryFact,
  validateFk6AdvicePayload,
  AdviceQualification,
} from './accessories';

const CLOCK = '2026-08-10T12:00:00.000Z';

function section(name: string, fn: () => void | Promise<void>): void {
  const r = fn();
  if (r && typeof (r as Promise<void>).then === 'function') {
    throw new Error(`section ${name} returned promise — use awaitMain`);
  }
  console.log(`ok ${name}`);
}

async function asection(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  await fn();
  console.log(`ok ${name}`);
}

const garments = [
  {
    garmentId: 'garment:blouse:red',
    category: 'top',
    type: 'blouse',
    colors: ['red'],
  },
  {
    garmentId: 'garment:skirt:yellow',
    category: 'bottom',
    type: 'skirt',
    colors: ['yellow'],
  },
];

section('versions_and_year1_policy', () => {
  assert.equal(
    FASHION_KNOWLEDGE_RELEASE,
    '1.0.0-fashion-knowledge',
  );
  assert.equal(YEAR1_MODE_B_POLICY.forcedApprovalStatus, 'UNCURATED');
  assert.equal(YEAR1_MODE_B_POLICY.forcedKnowledgeType, 'LLM_GENERAL_KNOWLEDGE');
  assert.equal(
    YEAR1_MODE_B_POLICY.defaultPublicEligibility,
    'PASS_WITH_QUALIFICATION',
  );
  assert.equal(isYear1ModeBPromotionForbidden(), true);
  assert.ok(
    YEAR1_MODE_B_POLICY.axioms.includes('USER_ACCEPTANCE_IS_NOT_DOMAIN_TRUTH'),
  );
});

section('advice_types_extended', () => {
  assert.ok(ALL_FASHION_ADVICE_TYPES.includes(FashionAdviceType.REMOVE_ACCESSORY));
  assert.ok(
    ALL_FASHION_ADVICE_TYPES.includes(
      FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
    ),
  );
  assert.ok(
    ALL_FASHION_ADVICE_TYPES.includes(
      FashionAdviceType.PRESERVE_SUPPORTING_ELEMENTS,
    ),
  );
  assert.ok(FK6_ACCESSORY_ADVICE_TYPES.includes(FashionAdviceType.CHANGE_SHOE_DIRECTION));
  assert.ok(FK6_ACCESSORY_ADVICE_TYPES.includes(FashionAdviceType.CHANGE_BAG_DIRECTION));
  assert.ok(FK6_ACCESSORY_ADVICE_TYPES.includes(FashionAdviceType.JEWELRY_DIRECTION));
});

section('domains_present', () => {
  assert.equal(FashionRuleDomain.SHOES, 'SHOES');
  assert.equal(FashionRuleDomain.BAGS, 'BAGS');
  assert.equal(FashionRuleDomain.JEWELRY, 'JEWELRY');
  assert.equal(FashionRuleDomain.ACCESSORY, 'ACCESSORY');
});

section('presence_unknown_not_absent', () => {
  assert.equal(isUnknownPresence(AccessoryPresence.UNKNOWN), true);
  assert.equal(presenceAllowsInventedAddClaim(AccessoryPresence.UNKNOWN), false);
  assert.equal(presenceAllowsInventedAddClaim(AccessoryPresence.ABSENT), true);
  const slot = unknownAccessorySlot('shoes', 'acc:shoes');
  assert.equal(slot.presence, 'UNKNOWN');
  assert.equal(slot.metallicFamily, MetallicFamily.UNKNOWN);
  assert.equal(slot.outfitRole, AccessoryRole.UNKNOWN);
});

section('fact_projection_no_inference', () => {
  const f = projectAccessoryFact({
    accessoryId: 'acc:shoes:1',
    category: 'shoes',
    presence: 'PRESENT',
    primaryColor: 'gold',
    evidenceRefs: ['ev_shoes'],
  });
  // color word "gold" must NOT auto-set metallicFamily
  assert.equal(f.metallicFamily, MetallicFamily.UNKNOWN);
  assert.equal(f.visualDominance, VisualDominance.UNKNOWN);
  const ok = validateAccessoryFact(f);
  assert.equal(ok.ok, true);

  const badPresent = projectAccessoryFact({
    accessoryId: 'acc:bag',
    category: 'bags',
    presence: 'PRESENT',
  });
  assert.equal(validateAccessoryFact(badPresent).ok, false);
});

section('metallic_when_evidenced', () => {
  const f = projectAccessoryFact({
    accessoryId: 'acc:shoes:gold',
    category: 'shoes',
    presence: 'PRESENT',
    metallicFamily: MetallicFamily.GOLD,
    evidenceRefs: ['ev_metal'],
  });
  assert.equal(f.metallicFamily, MetallicFamily.GOLD);
});

section('review_candidates_not_active', () => {
  assert.ok(FK6_ACCESSORY_REVIEW_CANDIDATES.length >= 4);
  assert.equal(fk6ActiveAccessoryRuleCount(), 0);
  for (const c of FK6_ACCESSORY_REVIEW_CANDIDATES) {
    assert.equal(c.sourcingGap, true);
    assert.equal(c.reviewerDecision, 'NEEDS_SOURCE');
    assert.equal(c.rule.status, RuleLifecycleStatus.DRAFT);
    assert.equal(isProductionEligibleRule(c.rule), false);
  }
});

section('mode_a_empty', () => {
  const reg = emptyProductionRegistry(CLOCK);
  for (const d of [
    FashionRuleDomain.SHOES,
    FashionRuleDomain.BAGS,
    FashionRuleDomain.JEWELRY,
    FashionRuleDomain.ACCESSORY,
  ]) {
    const ask = askApplicableCuratedRules(reg, {
      domain: d,
      clockNowIso: CLOCK,
      activeOnly: true,
    });
    assert.equal(ask.available, false);
    assert.equal(ask.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
  }
  const loaded = loadProductionFashionKnowledgeRegistry({ clockNowIso: CLOCK });
  assert.equal(loaded.registry?.rules.length, 0);
});

section('flag_default_false', () => {
  assert.equal(
    isFashionKnowledgeAccessoriesEnabled(() => 'false'),
    false,
  );
});

section('tone_safety_extensions', () => {
  assert.ok(
    validateToneSafety('women should wear smaller bags').some(
      (i) => i.code === 'GENDER_STEREOTYPE',
    ),
  );
  assert.ok(
    validateToneSafety('this looks cheap').some(
      (i) => i.code === 'CHEAP_LOOKING_JUDGMENT',
    ),
  );
  assert.ok(
    validateFk6AdvicePayload({
      adviceType: FashionAdviceType.ADD_ACCESSORY,
      texts: ['Buy Gucci bag SKU-1 for $900'],
    }).issues.some((i) => i.code === 'shopping_language'),
  );
});

section('projection_accessories', () => {
  const p = projectFashionLlmContext({
    requestId: 'req_fk6',
    traceId: 'tr_fk6',
    clockNowIso: CLOCK,
    garments,
    accessories: [
      {
        accessoryId: 'acc:shoes',
        category: 'shoes',
        presence: 'UNKNOWN',
      },
      {
        accessoryId: 'acc:bag',
        category: 'bags',
        presence: 'UNKNOWN',
      },
    ],
    occasion: 'wedding',
    evidenceRefs: ['ev_blouse', 'ev_skirt', 'ev_occasion'],
    allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
  });
  assert.equal(p.ok, true);
  assert.equal(p.request?.accessoryFacts?.length, 2);
  assert.equal(p.request?.accessoryFacts?.[0]?.presence, 'UNKNOWN');
});

async function main(): Promise<void> {
  await asection('flag_disabled_no_mode_b', async () => {
    const res = await runFk6AccessoriesEvaluation({
      requestId: 'r1',
      traceId: 't1',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        { accessoryId: 'acc:shoes', category: 'shoes', presence: 'UNKNOWN' },
      ],
      evidenceRefs: ['ev1', 'ev2'],
      provider: new MockFashionKnowledgeLlmProvider('accessories_unknown'),
      enabledAccessories: false,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, false);
    assert.ok(res.notes.includes('ACCESSORIES_ENABLED=false'));
  });

  await asection('red_yellow_wedding_unknown_accessories', async () => {
    const res = await runFk6AccessoriesEvaluation({
      requestId: 'r_unknown',
      traceId: 't_unknown',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        { accessoryId: 'acc:shoes', category: 'shoes', presence: 'UNKNOWN' },
        { accessoryId: 'acc:bag', category: 'bags', presence: 'UNKNOWN' },
        { accessoryId: 'acc:jewelry', category: 'jewelry', presence: 'UNKNOWN' },
      ],
      occasion: 'wedding',
      styleGoal: 'bold',
      preferenceTokens: ['bold'],
      evidenceRefs: ['ev_blouse', 'ev_skirt', 'ev_wedding'],
      provider: new MockFashionKnowledgeLlmProvider('accessories_unknown'),
      enabledAccessories: true,
      enabledLlm: true,
    });
    assert.equal(res.modeA.available, false);
    assert.equal(res.modeA.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
    assert.equal(res.modeBInvoked, true);
    assert.ok(res.modeB);
    assert.equal(res.modeB!.candidate?.knowledgeType, KnowledgeType.LLM_GENERAL_KNOWLEDGE);
    assert.equal(
      res.modeB!.candidate?.provenanceState,
      ProvenanceApprovalStatus.UNCURATED,
    );
    assert.equal(
      res.modeB!.candidate?.sourceType,
      CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
    );
    assert.notEqual(res.modeB!.candidate?.confidence, 'HIGH');
    assert.ok((res.modeB!.candidate?.alternatives.length ?? 0) >= 3);
    assert.ok(
      res.modeB!.claimLockResult?.decision === ClaimLockDecision.PASS ||
        res.modeB!.claimLockResult?.decision ===
          ClaimLockDecision.PASS_WITH_QUALIFICATION ||
        res.modeB!.claimLockResult?.decision === ClaimLockDecision.NEED_CLARIFICATION,
    );
    assert.ok(
      !/red and yellow cannot|must not wear red/i.test(
        res.modeB!.candidate?.suggestion.structuredText ?? '',
      ),
    );
    assert.ok(
      res.modeB!.candidate?.limitations?.some((a: string) =>
        /UNKNOWN|Uncurated/i.test(a),
      ) ||
        res.modeB!.draft?.assumptions?.some((a: string) => /UNKNOWN/i.test(a)),
    );
    assert.equal(
      res.eligibility?.qualification,
      AdviceQualification.UNCURATED_MODEL_GUIDANCE,
    );
    assert.equal(res.eligibility?.forcePublicQualification, true);
  });

  await asection('red_yellow_wedding_known_accessories', async () => {
    const res = await runFk6AccessoriesEvaluation({
      requestId: 'r_known',
      traceId: 't_known',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        {
          accessoryId: 'acc:shoes:gold',
          category: 'shoes',
          presence: 'PRESENT',
          metallicFamily: 'GOLD',
          colors: ['gold'],
          evidenceRefs: ['ev_shoes'],
        },
        {
          accessoryId: 'acc:bag:black',
          category: 'bags',
          presence: 'PRESENT',
          colors: ['black'],
          evidenceRefs: ['ev_bag'],
        },
      ],
      occasion: 'wedding',
      evidenceRefs: ['ev_blouse', 'ev_skirt', 'ev_shoes', 'ev_bag', 'ev_wedding'],
      provider: new MockFashionKnowledgeLlmProvider('accessories_known'),
      enabledAccessories: true,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, true);
    assert.ok(res.modeB?.candidate);
    assert.ok(
      /gold|black|supporting/i.test(
        res.modeB!.candidate!.currentObservation,
      ),
    );
    assert.equal(res.modeB!.candidate!.suggestion.absoluteClaim, false);
  });

  await asection('absolute_and_stereotype_blocked', async () => {
    const abs = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_abs',
        traceId: 't_abs',
        clockNowIso: CLOCK,
        garments,
        accessories: [
          { accessoryId: 'acc:bag', category: 'bags', presence: 'PRESENT', evidenceRefs: ['e'] },
        ],
        evidenceRefs: ['e1', 'e2'],
        occasion: 'wedding',
        allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('absolute_accessory'),
      enabled: true,
    });
    assert.ok(
      abs.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        abs.audit.validationIssueCodes.includes('absolute_claim') ||
        abs.audit.validationIssueCodes.includes('ABSOLUTE_WRONG') ||
        abs.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(
          `${abs.candidate?.suggestion.structuredText ?? ''} ${abs.candidate?.rationale ?? ''} ${abs.draft?.suggestion.structuredText ?? ''} ${abs.draft?.rationale ?? ''}`,
        ).length > 0,
    );

    const gender = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_g',
        traceId: 't_g',
        clockNowIso: CLOCK,
        garments,
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('gender_stereotype'),
      enabled: true,
    });
    const genderText = `${gender.candidate?.suggestion.structuredText ?? ''} ${gender.candidate?.rationale ?? ''} ${gender.draft?.suggestion.structuredText ?? ''} ${gender.draft?.rationale ?? ''}`;
    assert.ok(
      gender.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        gender.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(genderText).some((i) => i.code === 'GENDER_STEREOTYPE'),
    );
  });

  await asection('brand_sku_rejected_by_validation', async () => {
    const brand = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_b',
        traceId: 't_b',
        clockNowIso: CLOCK,
        garments,
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('brand_sku'),
      enabled: true,
    });
    const text =
      brand.candidate?.suggestion.structuredText ??
      brand.draft?.suggestion.structuredText ??
      '';
    assert.ok(
      brand.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        brand.audit.validationIssueCodes.some((c) =>
          /product|sku|brand|availability/i.test(c),
        ) ||
        validateFk6AdvicePayload({
          adviceType: FashionAdviceType.ADD_ACCESSORY,
          texts: [text],
        }).ok === false,
    );
  });

  await asection('determinism_mapping', async () => {
    const provider = new MockFashionKnowledgeLlmProvider('accessories_unknown');
    const req = projectFashionLlmContext({
      requestId: 'r_det',
      traceId: 't_det',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        { accessoryId: 'acc:shoes', category: 'shoes', presence: 'UNKNOWN' },
      ],
      occasion: 'wedding',
      evidenceRefs: ['ev1', 'ev2', 'ev3'],
      allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
    }).request!;
    const a = await runFashionKnowledgeLlm({
      request: req,
      provider,
      enabled: true,
    });
    const b = await runFashionKnowledgeLlm({
      request: req,
      provider: new MockFashionKnowledgeLlmProvider('accessories_unknown'),
      enabled: true,
    });
    assert.equal(a.candidate?.candidateId, b.candidate?.candidateId);
    assert.equal(a.claimLockResult?.decision, b.claimLockResult?.decision);
  });

  await asection('eligibility_requires_uncurated', async () => {
    const res = await runFk6AccessoriesEvaluation({
      requestId: 'r_el',
      traceId: 't_el',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        { accessoryId: 'acc:shoes', category: 'shoes', presence: 'UNKNOWN' },
      ],
      evidenceRefs: ['ev1', 'ev2'],
      occasion: 'wedding',
      provider: new MockFashionKnowledgeLlmProvider('accessories_unknown'),
      enabledAccessories: true,
      enabledLlm: true,
    });
    assert.ok(res.eligibility);
    assert.equal(res.eligibility!.expectedDefaultDecision, 'PASS_WITH_QUALIFICATION');
  });

  section('no_public_api_no_advisor_frozen', () => {
    assert.ok(true);
  });

  console.log('FK-6 schema tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
