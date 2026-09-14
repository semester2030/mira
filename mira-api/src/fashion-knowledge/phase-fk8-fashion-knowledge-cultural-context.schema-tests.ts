/**
 * FK-8 — Cultural Context Year-1 Mode B schema tests.
 * Culture is context — never identity. ACTIVE cultural rules = 0. Law #38.
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
  validateToneSafety,
  askApplicableCuratedRules,
  LookupReasonCode,
  runFashionKnowledgeLlm,
  projectFashionLlmContext,
  RuleLifecycleStatus,
  isProductionEligibleRule,
  FashionLlmRuntimeStatus,
  ConflictState,
} from './index';
import { emptyProductionRegistry } from './registry/storage';
import { MockFashionKnowledgeLlmProvider } from './llm/mock-provider';
import {
  ENGINEERING_LAW_38,
  isLaw38CompatibleWithFrozenLaws,
  CulturalContextConfidence,
  CulturalContextSourceType,
  CulturalEvaluationOutcome,
  ModestyPreference,
  RegionScope,
  normalizeFashionCulturalContext,
  culturalContextToLlmToken,
  isReligiousRulingRequest,
  FK8_CULTURAL_ADVICE_TYPES,
  YEAR1_MODE_B_CULTURAL_POLICY,
  evaluateFk8ModeBEligibility,
  isFashionKnowledgeCulturalContextEnabled,
  runFk8CulturalContextEvaluation,
  FK8_CULTURAL_REVIEW_CANDIDATES,
  FK8_CULTURAL_SOURCE_REQUIREMENTS,
  fk8ActiveCulturalRuleCount,
  validateCulturalContext,
  validateFk8AdvicePayload,
  law38GovernanceMarker,
  arabicLocaleIsNotSaudiIdentity,
  fk8AdviceForOutcome,
} from './cultural-context';

const CLOCK = '2026-08-10T12:00:00.000Z';

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

function section(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

async function asection(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  await fn();
  console.log(`ok ${name}`);
}

section('versions_and_law38', () => {
  assert.match(FASHION_KNOWLEDGE_RELEASE, /1\.0\.0-fashion-knowledge/);
  assert.equal(ENGINEERING_LAW_38.lawId, 38);
  assert.ok(isLaw38CompatibleWithFrozenLaws());
  assert.match(law38GovernanceMarker(), /LAW_38/);
  assert.ok(YEAR1_MODE_B_CULTURAL_POLICY.forbidLlmCulturalConventionAuthority);
  assert.equal(arabicLocaleIsNotSaudiIdentity(), true);
});

section('no_context', () => {
  const ctx = normalizeFashionCulturalContext({});
  assert.equal(ctx.confidence, CulturalContextConfidence.UNKNOWN);
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, false);
  assert.equal(ctx.identityInferred, false);
  assert.equal(validateCulturalContext(ctx).ok, true);
  assert.equal(culturalContextToLlmToken(ctx), undefined);
});

section('weak_locale_arabic_not_saudi', () => {
  const ctx = normalizeFashionCulturalContext({
    appLocale: 'ar-SA',
    locale: 'ar',
  });
  assert.equal(ctx.confidence, CulturalContextConfidence.WEAK);
  assert.equal(ctx.sourceType, CulturalContextSourceType.APP_LOCALE_WEAK);
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, false);
  assert.ok(ctx.limitations.includes('arabic_locale_is_not_saudi_identity'));
  assert.ok(ctx.limitations.includes('locale_is_not_cultural_identity'));
});

section('location_not_identity', () => {
  const ctx = normalizeFashionCulturalContext({
    locationHint: 'Riyadh',
    timezoneHint: 'Asia/Riyadh',
  });
  assert.ok(
    ctx.confidence === CulturalContextConfidence.WEAK ||
      ctx.confidence === CulturalContextConfidence.UNKNOWN,
  );
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, false);
  assert.ok(ctx.limitations.includes('location_hint_is_not_cultural_identity'));
});

section('explicit_saudi_wedding', () => {
  const ctx = normalizeFashionCulturalContext({
    userDeclared: true,
    explicitLabel: 'زواج سعودي',
    eventContext: 'wedding',
    evidenceRefs: ['user:selection'],
  });
  assert.equal(ctx.confidence, CulturalContextConfidence.EXPLICIT);
  assert.equal(ctx.userDeclared, true);
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, true);
  assert.equal(ctx.regionScope, RegionScope.REGION);
  assert.match(culturalContextToLlmToken(ctx) ?? '', /explicit:/);
});

section('user_clears_context', () => {
  const ctx = normalizeFashionCulturalContext({
    cleared: true,
    explicitLabel: 'should_be_ignored',
  });
  assert.equal(ctx.confidence, CulturalContextConfidence.UNKNOWN);
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, false);
  assert.ok(ctx.limitations.includes('context_cleared_by_user'));
});

section('modesty_preference_explicit_not_inferred', () => {
  const explicit = normalizeFashionCulturalContext({
    userDeclared: true,
    modestyPreference: ModestyPreference.MODEST,
    explicitLabel: 'prefer modest direction',
  });
  assert.equal(explicit.modestyPreference, ModestyPreference.MODEST);

  const cultureOnly = normalizeFashionCulturalContext({
    userDeclared: true,
    explicitLabel: 'Saudi wedding modest vibe',
  });
  assert.equal(cultureOnly.modestyPreference, ModestyPreference.UNKNOWN);
  assert.ok(
    cultureOnly.limitations.includes(
      'modesty_not_inferred_from_culture_label',
    ),
  );
});

section('country_not_identity_without_declaration', () => {
  const ctx = normalizeFashionCulturalContext({
    countryCode: 'SA',
    regionCode: 'GCC',
  });
  assert.equal(ctx.countryCode, undefined);
  assert.equal(ctx.mayInvokeRegionalKnowledgePath, false);
});

section('review_candidates_not_active', () => {
  assert.equal(fk8ActiveCulturalRuleCount(), 0);
  assert.equal(FK8_CULTURAL_SOURCE_REQUIREMENTS.activeCulturalRulesDefault, 0);
  assert.equal(FK8_CULTURAL_SOURCE_REQUIREMENTS.llmOnlyCannotActivate, true);
  for (const c of FK8_CULTURAL_REVIEW_CANDIDATES) {
    assert.equal(c.rule.status, RuleLifecycleStatus.DRAFT);
    assert.equal(isProductionEligibleRule(c.rule), false);
    assert.equal(c.needsCulturalReview, true);
    assert.equal(c.reviewerDecision, 'NEEDS_SOURCE');
    assert.equal(c.rule.knowledgeType, KnowledgeType.CULTURAL_CONVENTION);
    assert.ok(c.rule.culturalContext.length > 0);
  }
});

section('mode_a_empty', () => {
  const reg = emptyProductionRegistry(CLOCK);
  const r = askApplicableCuratedRules(reg, {
    domain: FashionRuleDomain.CULTURAL_CONTEXT,
    clockNowIso: CLOCK,
    activeOnly: true,
  });
  assert.equal(r.available, false);
  assert.equal(r.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
});

section('flag_default_false', () => {
  assert.equal(
    isFashionKnowledgeCulturalContextEnabled(() => undefined),
    false,
  );
});

section('tone_cultural_safety', () => {
  assert.ok(
    validateToneSafety('Saudi women usually should wear muted colors').some(
      (i) => i.code === 'CULTURAL_STEREOTYPE',
    ),
  );
  assert.ok(
    validateToneSafety('This outfit is religiously forbidden').some(
      (i) => i.code === 'RELIGIOUS_RULING',
    ),
  );
  assert.ok(
    validateToneSafety('improper woman for this wedding').some(
      (i) => i.code === 'MORAL_SHAME_LANGUAGE',
    ),
  );
  assert.ok(isReligiousRulingRequest('هل هذه الإطلالة مخالفة دينيًا؟'));
  assert.equal(
    fk8AdviceForOutcome(CulturalEvaluationOutcome.OUT_OF_SCOPE_RELIGION),
    FashionAdviceType.CLARIFICATION_REQUIRED,
  );
});

section('shopping_blocked', () => {
  assert.equal(
    validateFk8AdvicePayload({
      adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
      texts: ['Buy abaya SKU-1 for $400'],
    }).ok,
    false,
  );
});

async function main(): Promise<void> {
  await asection('flag_disabled', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r0',
      traceId: 't0',
      clockNowIso: CLOCK,
      garments,
      occasion: 'wedding',
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: false,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, false);
  });

  await asection('scenario_a_unknown_culture_wedding', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_a',
      traceId: 't_a',
      clockNowIso: CLOCK,
      garments,
      occasion: 'wedding',
      evidenceRefs: ['ev1', 'ev2', 'ev3'],
      culturalInput: {},
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.equal(res.cultural.confidence, CulturalContextConfidence.UNKNOWN);
    assert.equal(res.cultural.mayInvokeRegionalKnowledgePath, false);
    assert.equal(res.outcome, CulturalEvaluationOutcome.GENERIC_OCCASION_ONLY);
    assert.equal(res.modeA.available, false);
    assert.equal(res.modeBInvoked, true);
    assert.ok(res.modeB?.candidate);
    assert.equal(
      res.modeB!.candidate!.sourceType,
      CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
    );
    assert.equal(
      res.modeB!.candidate!.provenanceState,
      ProvenanceApprovalStatus.UNCURATED,
    );
    assert.equal(
      res.modeB!.candidate!.knowledgeType,
      KnowledgeType.LLM_GENERAL_KNOWLEDGE,
    );
    assert.ok(
      !/saudi|gulf|سعود/i.test(res.modeB!.candidate!.suggestion.structuredText),
    );
    assert.ok(res.modeB!.audit.claimLockInvoked);
  });

  await asection('scenario_b_explicit_saudi_bold', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_b',
      traceId: 't_b',
      clockNowIso: CLOCK,
      garments,
      accessories: [
        {
          accessoryId: 'acc:shoes',
          category: 'shoes',
          presence: 'UNKNOWN',
        },
      ],
      occasion: 'wedding',
      styleGoal: 'bold',
      preferenceTokens: ['bold', 'جريئة'],
      culturalInput: {
        userDeclared: true,
        explicitLabel: 'المناسبة زواج سعودي وأبي الإطلالة جريئة',
        eventContext: 'wedding',
        evidenceRefs: ['user:msg'],
      },
      evidenceRefs: ['ev1', 'ev2', 'ev3', 'user:msg'],
      oiModestySummary: 'unevaluated',
      provider: new MockFashionKnowledgeLlmProvider(
        'cultural_explicit_saudi_bold',
      ),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.equal(res.cultural.confidence, CulturalContextConfidence.EXPLICIT);
    assert.equal(res.cultural.mayInvokeRegionalKnowledgePath, true);
    assert.equal(res.oiModestyBoundary, 'CONSUME_ONLY');
    assert.equal(res.preferenceConflict, ConflictState.POSSIBLE_CONFLICT);
    assert.equal(res.modeBInvoked, true);
    assert.ok((res.modeB!.candidate!.alternatives?.length ?? 0) >= 2);
    assert.equal(
      res.modeB!.candidate!.knowledgeType,
      KnowledgeType.LLM_GENERAL_KNOWLEDGE,
    );
    assert.ok(
      res.modeB!.claimLockResult?.decision === ClaimLockDecision.PASS ||
        res.modeB!.claimLockResult?.decision ===
          ClaimLockDecision.PASS_WITH_QUALIFICATION ||
        res.modeB!.claimLockResult?.decision ===
          ClaimLockDecision.NEED_CLARIFICATION,
    );
    assert.ok(
      !/usually should|authority|banned/i.test(
        res.modeB!.candidate!.suggestion.structuredText,
      ),
    );
  });

  await asection('scenario_c_arabic_riyadh_weak', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_c',
      traceId: 't_c',
      clockNowIso: CLOCK,
      garments,
      occasion: 'wedding',
      culturalInput: {
        appLocale: 'ar',
        locationHint: 'Riyadh',
        timezoneHint: 'Asia/Riyadh',
      },
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.ok(
      res.cultural.confidence === CulturalContextConfidence.WEAK ||
        res.cultural.confidence === CulturalContextConfidence.UNKNOWN,
    );
    assert.equal(res.cultural.mayInvokeRegionalKnowledgePath, false);
    assert.notEqual(res.outcome, 'SAUDI_WEDDING');
  });

  await asection('scenario_d_religion_out_of_scope', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_d',
      traceId: 't_d',
      clockNowIso: CLOCK,
      garments,
      evidenceRefs: ['e1'],
      userQuestion: 'هل هذه الإطلالة مخالفة دينيًا؟',
      provider: new MockFashionKnowledgeLlmProvider('cultural_religious_ruling'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.equal(
      res.outcome,
      CulturalEvaluationOutcome.OUT_OF_SCOPE_RELIGION,
    );
    assert.equal(res.modeBInvoked, false);
  });

  await asection('stereotype_and_religion_blocked', async () => {
    const stereo = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_st',
        traceId: 't_st',
        clockNowIso: CLOCK,
        garments,
        occasion: 'wedding',
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK8_CULTURAL_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('cultural_stereotype'),
      enabled: true,
    });
    const stText = `${stereo.draft?.suggestion.structuredText ?? ''} ${stereo.draft?.rationale ?? ''}`;
    assert.ok(
      stereo.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        stereo.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(stText).some(
          (i) => i.code === 'CULTURAL_STEREOTYPE',
        ),
    );

    const rel = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_rel',
        traceId: 't_rel',
        clockNowIso: CLOCK,
        garments,
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK8_CULTURAL_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider(
        'cultural_religious_ruling',
      ),
      enabled: true,
    });
    const relText = `${rel.draft?.suggestion.structuredText ?? ''} ${rel.draft?.rationale ?? ''}`;
    assert.ok(
      rel.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        rel.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(relText).some((i) => i.code === 'RELIGIOUS_RULING'),
    );
  });

  await asection('cultural_authority_downgraded_or_blocked', async () => {
    const auth = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_auth',
        traceId: 't_auth',
        clockNowIso: CLOCK,
        garments,
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK8_CULTURAL_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('cultural_authority_claim'),
      enabled: true,
    });
    assert.ok(
      auth.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        auth.candidate?.knowledgeType ===
          KnowledgeType.LLM_GENERAL_KNOWLEDGE ||
        auth.claimLockResult?.decision === ClaimLockDecision.BLOCK,
    );
    if (auth.candidate) {
      assert.notEqual(
        auth.candidate.knowledgeType,
        KnowledgeType.CULTURAL_CONVENTION,
      );
    }
  });

  await asection('context_cleared_path', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_clr',
      traceId: 't_clr',
      clockNowIso: CLOCK,
      garments,
      evidenceRefs: ['e1'],
      culturalInput: { cleared: true },
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.equal(res.outcome, CulturalEvaluationOutcome.CONTEXT_CLEARED);
    assert.equal(res.modeBInvoked, false);
  });

  await asection('determinism', async () => {
    const provider = new MockFashionKnowledgeLlmProvider(
      'cultural_explicit_saudi_bold',
    );
    const mk = () =>
      runFk8CulturalContextEvaluation({
        requestId: 'r_det',
        traceId: 't_det',
        clockNowIso: CLOCK,
        garments,
        occasion: 'wedding',
        preferenceTokens: ['bold'],
        culturalInput: {
          userDeclared: true,
          explicitLabel: 'Saudi wedding',
          eventContext: 'wedding',
        },
        evidenceRefs: ['e1', 'e2', 'e3'],
        provider,
        enabledCultural: true,
        enabledLlm: true,
      });
    const a = await mk();
    const b = await mk();
    assert.equal(a.cultural.confidence, b.cultural.confidence);
    assert.equal(a.modeB!.candidate?.candidateId, b.modeB!.candidate?.candidateId);
    assert.equal(
      a.modeB!.claimLockResult?.decision,
      b.modeB!.claimLockResult?.decision,
    );
  });

  await asection('eligibility_forces_uncurated', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_el',
      traceId: 't_el',
      clockNowIso: CLOCK,
      garments,
      occasion: 'wedding',
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.ok(res.eligibility);
    assert.equal(res.eligibility!.forcePublicQualification, true);
  });

  await asection('fk7_intersection_silhouette_facts', async () => {
    const res = await runFk8CulturalContextEvaluation({
      requestId: 'r_fk7',
      traceId: 't_fk7',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'u',
          category: 'top',
          silhouette: 'oversized',
          colors: ['red'],
        },
        {
          garmentId: 'l',
          category: 'bottom',
          silhouette: 'flared',
          colors: ['yellow'],
        },
      ],
      occasion: 'wedding',
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('cultural_generic_wedding'),
      enabledCultural: true,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, true);
    assert.ok(
      res.modeB!.candidate!.targetRefs.some((r) => r === 'u' || r === 'l'),
    );
  });

  await asection('no_public_api_frozen_markers', async () => {
    assert.ok(ENGINEERING_LAW_38.doesNotModify.includes('#1–#37'));
    assert.equal(evaluateFk8ModeBEligibility({}).eligible, false);
  });

  console.log('FK-8 schema tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
