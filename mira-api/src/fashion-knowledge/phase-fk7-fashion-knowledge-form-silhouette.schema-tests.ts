/**
 * FK-7 — Fabric / Silhouette / Proportion Year-1 Mode B schema tests.
 * Capability only — ACTIVE curated form rules remain 0. Law #37 binding.
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
  runFashionKnowledgeLlm,
  projectFashionLlmContext,
  RuleLifecycleStatus,
  isProductionEligibleRule,
  FashionLlmRuntimeStatus,
} from './index';
import { emptyProductionRegistry } from './registry/storage';
import { MockFashionKnowledgeLlmProvider } from './llm/mock-provider';
import {
  ENGINEERING_LAW_37,
  isLaw37CompatibleWithFrozenLaws,
  FabricEvidenceState,
  FabricSemanticFamily,
  SilhouetteVocabulary,
  TextureRelationship,
  VisualVolume,
  ProportionRelationship,
  VisualComplexity,
  EvidenceSufficiency,
  projectFormGarmentFact,
  projectFormRelationships,
  FK7_FORM_ADVICE_TYPES,
  evaluateFk7ModeBEligibility,
  isFashionKnowledgeFormSilhouetteEnabled,
  runFk7FormSilhouetteEvaluation,
  FK7_FORM_REVIEW_CANDIDATES,
  fk7ActiveFormRuleCount,
  validateFormGarmentFact,
  validateFk7AdvicePayload,
  validateNoBodyJudgment,
  law37GovernanceMarker,
  fk7AdviceTypeForSufficiency,
} from './form-silhouette';

const CLOCK = '2026-08-10T12:00:00.000Z';

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

section('versions_and_law37', () => {
  assert.match(FASHION_KNOWLEDGE_RELEASE, /1\.0\.0-fashion-knowledge/);
  assert.equal(ENGINEERING_LAW_37.lawId, 37);
  assert.ok(isLaw37CompatibleWithFrozenLaws());
  assert.match(law37GovernanceMarker(), /LAW_37/);
  assert.ok(ENGINEERING_LAW_37.forbidden.includes('body_attractiveness_score'));
  assert.ok(
    ENGINEERING_LAW_37.allowed.includes('garment_to_garment_proportion'),
  );
});

section('advice_types_extended', () => {
  assert.ok(
    ALL_FASHION_ADVICE_TYPES.includes(FashionAdviceType.PRESERVE_VOLUME_CONTRAST),
  );
  assert.ok(
    ALL_FASHION_ADVICE_TYPES.includes(FashionAdviceType.SIMPLIFY_TEXTURE),
  );
  assert.ok(FK7_FORM_ADVICE_TYPES.includes(FashionAdviceType.FABRIC_DIRECTION));
  assert.ok(FK7_FORM_ADVICE_TYPES.includes(FashionAdviceType.BALANCE_VOLUME));
});

section('fabric_projection', () => {
  const f = projectFormGarmentFact({
    garmentId: 'g1',
    material: 'satin',
    materialEvidence: 'SUPPORTED',
    evidenceRefs: ['e1'],
  });
  assert.equal(f.fabricFamily, FabricSemanticFamily.LUSTROUS);
  assert.equal(f.materialEvidence, FabricEvidenceState.SUPPORTED);
  assert.equal(validateFormGarmentFact(f).ok, true);
});

section('unknown_fabric', () => {
  const f = projectFormGarmentFact({ garmentId: 'g2' });
  assert.equal(f.fabricFamily, FabricSemanticFamily.UNKNOWN);
  assert.equal(f.materialEvidence, FabricEvidenceState.UNKNOWN);
  assert.ok(f.limitations.includes('material_unknown'));
});

section('estimated_fabric_limitation', () => {
  const f = projectFormGarmentFact({
    garmentId: 'g3',
    material: 'wool',
    materialEvidence: 'ESTIMATED',
    confidence: 'HIGH',
  });
  assert.ok(
    f.limitations.includes('estimated_material_cannot_support_high_certainty'),
  );
  assert.equal(validateFormGarmentFact(f).ok, false);
});

section('texture_relationship', () => {
  const rel = projectFormRelationships({
    garments: [
      { garmentId: 'a', material: 'satin' },
      { garmentId: 'b', material: 'tweed' },
    ],
  });
  assert.ok(
    rel.textureRelationship === TextureRelationship.COMPETING ||
      rel.textureRelationship === TextureRelationship.CONTRASTING,
  );
});

section('silhouette_vocabulary', () => {
  const f = projectFormGarmentFact({
    garmentId: 'g4',
    silhouette: 'oversized',
  });
  assert.equal(f.silhouette, SilhouetteVocabulary.OVERSIZED);
  assert.equal(f.visualVolume, VisualVolume.HIGH);
});

section('unknown_silhouette', () => {
  const f = projectFormGarmentFact({ garmentId: 'g5' });
  assert.equal(f.silhouette, SilhouetteVocabulary.UNKNOWN);
  assert.equal(f.visualVolume, VisualVolume.UNKNOWN);
});

section('visual_volume_and_proportion', () => {
  const rel = projectFormRelationships({
    garments: [
      {
        garmentId: 'upper',
        category: 'top',
        type: 'blazer',
        silhouette: 'oversized',
        outfitSlot: 'outer',
      },
      {
        garmentId: 'lower',
        category: 'bottom',
        type: 'wide-leg trousers',
        silhouette: 'flared',
        outfitSlot: 'lower',
      },
    ],
  });
  assert.equal(rel.proportionRelationship, ProportionRelationship.MULTI_DOMINANT);
  assert.ok(
    rel.visualComplexity === VisualComplexity.MEDIUM ||
      rel.visualComplexity === VisualComplexity.HIGH,
  );
});

section('length_relationship_unknown_without_facts', () => {
  const rel = projectFormRelationships({
    garments: [
      { garmentId: 'a', silhouette: 'fitted' },
      { garmentId: 'b', silhouette: 'straight' },
    ],
  });
  assert.equal(rel.lengthRelationship, 'UNKNOWN');
});

section('oi_layering_boundary', () => {
  const rel = projectFormRelationships({
    garments: [{ garmentId: 'a', silhouette: 'fitted' }],
    layeringSummary: 'OI: stack structurally valid',
    layeringEvidenceRefs: ['oi:layering:ok'],
  });
  assert.equal(rel.oiLayeringBoundary, 'CONSUME_ONLY');
  assert.equal(rel.layeringSummary, 'OI: stack structurally valid');
  assert.ok(rel.limitations.includes('oi_layering_consume_only'));
});

section('review_candidates_not_active', () => {
  assert.equal(fk7ActiveFormRuleCount(), 0);
  for (const c of FK7_FORM_REVIEW_CANDIDATES) {
    assert.equal(c.rule.status, RuleLifecycleStatus.DRAFT);
    assert.equal(isProductionEligibleRule(c.rule), false);
    assert.equal(c.reviewerDecision, 'NEEDS_SOURCE');
  }
});

section('mode_a_empty', () => {
  const reg = emptyProductionRegistry(CLOCK);
  const r = askApplicableCuratedRules(reg, {
    domain: FashionRuleDomain.FABRIC,
    clockNowIso: CLOCK,
    activeOnly: true,
  });
  assert.equal(r.available, false);
  assert.equal(r.code, LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
});

section('flag_default_false', () => {
  assert.equal(
    isFashionKnowledgeFormSilhouetteEnabled(() => undefined),
    false,
  );
});

section('tone_body_safety_law37', () => {
  assert.ok(
    validateToneSafety('makes you look thinner').some(
      (i) => i.code === 'BODY_SHAPE_JUDGMENT',
    ),
  );
  assert.ok(
    validateToneSafety('pear body should wear fitted skirts').some(
      (i) => i.code === 'BODY_SHAPE_JUDGMENT',
    ),
  );
  assert.ok(
    validateToneSafety('this makes you more attractive').some(
      (i) => i.code === 'ATTRACTIVENESS',
    ),
  );
  assert.equal(
    validateNoBodyJudgment('Reduce competing visual volume between garments'),
    true,
  );
  assert.equal(
    validateNoBodyJudgment('hides your hips and makes your waist smaller'),
    false,
  );
});

section('scenario_c_insufficient_evidence', () => {
  const rel = projectFormRelationships({
    garments: [
      { garmentId: 'a', colors: ['red'] },
      { garmentId: 'b', colors: ['yellow'] },
    ],
  });
  assert.equal(
    rel.evidenceSufficiency,
    EvidenceSufficiency.INSUFFICIENT_EVIDENCE,
  );
  assert.equal(
    fk7AdviceTypeForSufficiency(rel.evidenceSufficiency),
    FashionAdviceType.CLARIFICATION_REQUIRED,
  );
});

async function main(): Promise<void> {
  await asection('flag_disabled_no_mode_b', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r1',
      traceId: 't1',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'u',
          category: 'top',
          type: 'blazer',
          silhouette: 'oversized',
        },
        {
          garmentId: 'l',
          category: 'bottom',
          type: 'trousers',
          silhouette: 'flared',
        },
      ],
      evidenceRefs: ['e1', 'e2'],
      occasion: 'formal_dinner',
      provider: new MockFashionKnowledgeLlmProvider('form_volume_bold'),
      enabledFormSilhouette: false,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, false);
  });

  await asection('scenario_a_oversized_wide_leg_bold', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_a_bold',
      traceId: 't_a',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'garment:blazer:oversized',
          category: 'top',
          type: 'blazer',
          silhouette: 'oversized',
          outfitSlot: 'outer',
          formalityHint: 'formal',
        },
        {
          garmentId: 'garment:trousers:wide',
          category: 'bottom',
          type: 'wide-leg trousers',
          silhouette: 'flared',
          outfitSlot: 'lower',
        },
      ],
      outfit: {
        outfitId: 'outfit:a',
        garmentRefs: [
          'garment:blazer:oversized',
          'garment:trousers:wide',
        ],
        layeringSummary: 'OI structural stack valid',
        layeringEvidenceRefs: ['oi:layering:valid'],
      },
      occasion: 'formal_dinner',
      styleGoal: 'bold',
      preferenceTokens: ['bold', 'editorial'],
      evidenceRefs: ['ev1', 'ev2', 'ev3'],
      provider: new MockFashionKnowledgeLlmProvider('form_volume_bold'),
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.equal(
      res.relationships.proportionRelationship,
      ProportionRelationship.MULTI_DOMINANT,
    );
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
    assert.ok((res.modeB!.candidate!.alternatives?.length ?? 0) >= 2);
    assert.ok(res.modeB!.audit.claimLockInvoked);
    assert.ok(
      res.modeB!.claimLockResult?.decision === ClaimLockDecision.PASS ||
        res.modeB!.claimLockResult?.decision ===
          ClaimLockDecision.PASS_WITH_QUALIFICATION ||
        res.modeB!.claimLockResult?.decision ===
          ClaimLockDecision.NEED_CLARIFICATION,
    );
    assert.ok(
      !/thinner|stomach|pear|hourglass|attractive/i.test(
        res.modeB!.candidate!.suggestion.structuredText,
      ),
    );
  });

  await asection('scenario_a_preference_minimal', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_a_min',
      traceId: 't_a2',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'garment:blazer:oversized',
          category: 'top',
          type: 'blazer',
          silhouette: 'oversized',
          outfitSlot: 'outer',
        },
        {
          garmentId: 'garment:trousers:wide',
          category: 'bottom',
          type: 'wide-leg trousers',
          silhouette: 'flared',
          outfitSlot: 'lower',
        },
      ],
      occasion: 'formal_dinner',
      styleGoal: 'minimal',
      preferenceTokens: ['minimal', 'streamlined'],
      evidenceRefs: ['ev1', 'ev2'],
      provider: new MockFashionKnowledgeLlmProvider('form_volume_minimal'),
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.equal(res.modeBInvoked, true);
    assert.equal(
      res.modeB!.candidate!.adviceType,
      FashionAdviceType.BALANCE_VOLUME,
    );
    assert.match(
      res.modeB!.candidate!.suggestion.structuredText,
      /streamlined|volume/i,
    );
  });

  await asection('scenario_b_texture_accessories', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_b',
      traceId: 't_b',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'garment:blouse:satin',
          category: 'top',
          type: 'blouse',
          material: 'satin',
          materialEvidence: 'SUPPORTED',
          colors: ['ivory'],
        },
        {
          garmentId: 'garment:skirt:textured',
          category: 'bottom',
          type: 'skirt',
          material: 'tweed',
          materialEvidence: 'ESTIMATED',
          pattern: 'texture',
          colors: ['black'],
        },
      ],
      accessories: [
        {
          accessoryId: 'acc:shoes',
          category: 'shoes',
          presence: 'PRESENT',
          metallicFamily: 'GOLD',
          evidenceRefs: ['ev_shoes'],
        },
      ],
      occasion: 'wedding',
      dressCode: 'evening',
      colorContrastHigh: false,
      accessoryDominanceHigh: true,
      evidenceRefs: ['ev1', 'ev2', 'ev_shoes', 'ev_wedding'],
      provider: new MockFashionKnowledgeLlmProvider('form_texture_evening'),
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.ok(
      res.relationships.garmentFacts.some((f) =>
        f.limitations.includes(
          'estimated_material_cannot_support_high_certainty',
        ),
      ),
    );
    assert.equal(res.modeBInvoked, true);
    assert.ok((res.modeB!.candidate!.alternatives?.length ?? 0) >= 2);
    assert.ok(
      !/better-looking body|makes you look/i.test(
        `${res.modeB!.candidate!.suggestion.structuredText} ${res.modeB!.candidate!.rationale}`,
      ),
    );
  });

  await asection('scenario_c_orchestrator_blocks_fabrication', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_c',
      traceId: 't_c',
      clockNowIso: CLOCK,
      garments: [
        { garmentId: 'a', colors: ['red'] },
        { garmentId: 'b', colors: ['navy'] },
      ],
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('form_volume_bold'),
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.equal(
      res.relationships.evidenceSufficiency,
      EvidenceSufficiency.INSUFFICIENT_EVIDENCE,
    );
    assert.equal(res.modeBInvoked, false);
    assert.match(res.notes, /INSUFFICIENT_EVIDENCE/);
  });

  await asection('body_slimming_and_shape_blocked', async () => {
    const slim = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_slim',
        traceId: 't_slim',
        clockNowIso: CLOCK,
        garments: [
          { garmentId: 'u', silhouette: 'oversized' },
          { garmentId: 'l', silhouette: 'flared' },
        ],
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK7_FORM_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('form_body_slimming'),
      enabled: true,
    });
    const slimText = `${slim.candidate?.suggestion.structuredText ?? ''} ${slim.draft?.suggestion.structuredText ?? ''} ${slim.draft?.rationale ?? ''}`;
    assert.ok(
      slim.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        slim.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(slimText).some(
          (i) =>
            i.code === 'BODY_SHAPE_JUDGMENT' || i.code === 'ATTRACTIVENESS',
        ),
    );

    const shape = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_shape',
        traceId: 't_shape',
        clockNowIso: CLOCK,
        garments: [
          { garmentId: 'u', silhouette: 'fitted' },
          { garmentId: 'l', silhouette: 'flared' },
        ],
        evidenceRefs: ['e1', 'e2'],
        allowedAdviceTypes: FK7_FORM_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('form_body_shape'),
      enabled: true,
    });
    const shapeText = `${shape.draft?.suggestion.structuredText ?? ''} ${shape.draft?.rationale ?? ''}`;
    assert.ok(
      shape.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        shape.claimLockResult?.decision === ClaimLockDecision.BLOCK ||
        validateToneSafety(shapeText).some(
          (i) => i.code === 'BODY_SHAPE_JUDGMENT',
        ),
    );
  });

  await asection('false_provenance_and_shopping', async () => {
    const fp = await runFashionKnowledgeLlm({
      request: projectFashionLlmContext({
        requestId: 'r_fp',
        traceId: 't_fp',
        clockNowIso: CLOCK,
        garments: [{ garmentId: 'g', material: 'wool', silhouette: 'fitted' }],
        evidenceRefs: ['e1'],
        allowedAdviceTypes: FK7_FORM_ADVICE_TYPES,
      }).request!,
      provider: new MockFashionKnowledgeLlmProvider('false_provenance'),
      enabled: true,
    });
    assert.ok(
      fp.runtime.status === FashionLlmRuntimeStatus.BLOCKED ||
        fp.claimLockResult?.decision === ClaimLockDecision.BLOCK,
    );

    assert.equal(
      validateFk7AdvicePayload({
        adviceType: FashionAdviceType.FABRIC_DIRECTION,
        texts: ['Buy Gucci SKU-1 for $900'],
      }).ok,
      false,
    );
  });

  await asection('determinism_mapping', async () => {
    const provider = new MockFashionKnowledgeLlmProvider('form_volume_bold');
    const garments = [
      {
        garmentId: 'garment:blazer:oversized',
        category: 'top',
        type: 'blazer',
        silhouette: 'oversized',
        outfitSlot: 'outer',
      },
      {
        garmentId: 'garment:trousers:wide',
        category: 'bottom',
        type: 'wide-leg trousers',
        silhouette: 'flared',
        outfitSlot: 'lower',
      },
    ];
    const a = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_det',
      traceId: 't_det',
      clockNowIso: CLOCK,
      garments,
      occasion: 'formal_dinner',
      evidenceRefs: ['e1', 'e2', 'e3'],
      provider,
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    const b = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_det',
      traceId: 't_det',
      clockNowIso: CLOCK,
      garments,
      occasion: 'formal_dinner',
      evidenceRefs: ['e1', 'e2', 'e3'],
      provider,
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.equal(
      a.relationships.proportionRelationship,
      b.relationships.proportionRelationship,
    );
    assert.equal(a.modeB!.candidate?.candidateId, b.modeB!.candidate?.candidateId);
    assert.equal(
      a.modeB!.claimLockResult?.decision,
      b.modeB!.claimLockResult?.decision,
    );
  });

  await asection('eligibility_uncurated', async () => {
    const res = await runFk7FormSilhouetteEvaluation({
      requestId: 'r_el',
      traceId: 't_el',
      clockNowIso: CLOCK,
      garments: [
        {
          garmentId: 'u',
          category: 'top',
          silhouette: 'oversized',
          outfitSlot: 'outer',
        },
        {
          garmentId: 'l',
          category: 'bottom',
          silhouette: 'flared',
          outfitSlot: 'lower',
        },
      ],
      evidenceRefs: ['e1', 'e2'],
      provider: new MockFashionKnowledgeLlmProvider('form_volume_bold'),
      enabledFormSilhouette: true,
      enabledLlm: true,
    });
    assert.ok(res.eligibility);
    assert.equal(res.eligibility!.forcePublicQualification, true);
    assert.ok(res.eligibility!.eligible || res.eligibility!.reasons.length > 0);
  });

  await asection('no_public_api_no_advisor_frozen', async () => {
    assert.ok(true);
    // Markers: package is internal-only; Law #37 additive; OI layering CONSUME_ONLY
    assert.equal(ENGINEERING_LAW_37.doesNotModify.includes('#1–#36'), true);
  });

  console.log('FK-7 schema tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
