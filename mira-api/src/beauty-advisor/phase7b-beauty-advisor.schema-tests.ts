/**
 * Phase 7B + 7B.1 — AI Beauty Advisor tests (incl. audit remediation).
 * Run: npm run test:phase7b
 */
import assert from 'node:assert/strict';
import {
  ADVISOR_ENVELOPE_VERSION,
  ADVISOR_RUNTIME_VERSION,
  BEAUTY_ADVISOR_RELEASE,
  ENGINEERING_LAW_34,
} from './release';
import {
  makeEvidenceUnit,
  sealAdvisorEvidenceEnvelope,
} from './envelope/envelope-builder';
import { detectAdvisorIntent } from './conversation/intent-detection';
import { routeCapability } from './routing/capability-router';
import { planConversation } from './planner/conversation-planner';
import { generateGroundedResponse } from './response/grounded-response-engine';
import { runAdvisorTurn } from './conversation/conversation-engine';
import {
  appendConversationTurn,
  createAdvisorMemoryBundle,
  evolveMemoryRefs,
} from './memory/advisor-memory-store';
import {
  assertLaw34,
  assertValidEnvelope,
  validateEnvelopeCompleteness,
  validateLaw34Response,
  validatePlannerConsistency,
  validateExpiredEvidence,
} from './validation/advisor-validators';
import { BeautyAdvisorService } from './beauty-advisor.service';
import { projectMceSnapshotToEvidenceUnits } from './evidence/public-evidence-projector';
import { validateEnvelopeProvenance } from './evidence/provenance';
import type { MceContextSnapshotV1 } from '../consultation/contracts/mce-context-snapshot.v1';
import { DEFAULT_FORBIDDEN_CLAIMS } from './contracts/advisor-evidence-envelope';

const NOW = '2026-07-19T00:00:00.000Z';

function sampleSkinUnits() {
  return [
    makeEvidenceUnit({
      subsystemId: 'skin_intelligence',
      claimKey: 'skin.type',
      statementAr: 'نوع البشرة: مختلطة',
      confidence: 'high',
      capabilityId: 'skin_report',
      sourceRef: 'skin_1',
      provenance: 'canonical_skin_report',
      now: NOW,
    }),
    makeEvidenceUnit({
      subsystemId: 'skin_intelligence',
      claimKey: 'skin.routine.morning',
      statementAr: 'الروتين الصباحي: منظف، مرطب، واقي شمس',
      confidence: 'medium',
      capabilityId: 'skin_report',
      sourceRef: 'skin_1',
      provenance: 'canonical_skin_report',
      now: NOW,
    }),
  ];
}

function testVersions(): void {
  assert.equal(BEAUTY_ADVISOR_RELEASE, '1.0.0-beauty-advisor');
  assert.equal(ADVISOR_ENVELOPE_VERSION, 'advisor-envelope-v1');
  assert.equal(ADVISOR_RUNTIME_VERSION, 'advisor-runtime-v1');
  assert.match(ENGINEERING_LAW_34, /Envelope/);
  console.log('ok versions');
}

function testEnvelopeSeal(): void {
  const envelope = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_1',
    units: sampleSkinUnits(),
    now: NOW,
  });
  assert.equal(envelope.sealed, true);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.claims));
  assertValidEnvelope(envelope);
  assert.equal(validateEnvelopeCompleteness(envelope).ok, true);
  console.log('ok envelope');
}

function testIntentAndRouting(): void {
  assert.equal(detectAdvisorIntent('ما نوع بشرتي؟'), 'skin');
  assert.equal(detectAdvisorIntent('كيف إطلالي؟'), 'outfit');
  assert.equal(detectAdvisorIntent('أريد شراء منتج'), 'unsupported');
  assert.equal(routeCapability('skin').targetSubsystems[0], 'skin_intelligence');
  console.log('ok intent_routing');
}

function testPlannerEnvelopeOnly(): void {
  const envelope = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_plan',
    units: sampleSkinUnits(),
    now: NOW,
  });
  const plan = planConversation({
    intent: 'skin',
    envelope,
    route: routeCapability('skin'),
  });
  assert.equal(plan.answerStrategy, 'grounded');
  assert.equal(validatePlannerConsistency(envelope, plan).ok, true);

  const empty = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_empty',
    units: [],
    now: NOW,
  });
  assert.equal(empty.freshness.stale, false);
  const clarify = planConversation({
    intent: 'skin',
    envelope: empty,
    route: routeCapability('skin'),
  });
  assert.equal(clarify.answerStrategy, 'clarify');
  assert.equal(clarify.primaryReasonCode, 'missing_evidence');
  console.log('ok planner');
}

function testStaleNeverGrounded(): void {
  const staleUnit = makeEvidenceUnit({
    subsystemId: 'skin_intelligence',
    claimKey: 'skin.type',
    statementAr: 'قديم',
    confidence: 'high',
    provenance: 'canonical_skin_report',
    freshness: { builtAt: '2020-01-01T00:00:00.000Z', stale: true },
    now: NOW,
  });
  const envelope = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_stale',
    units: [staleUnit],
    now: NOW,
  });
  assert.equal(envelope.freshness.stale, true);
  assert.equal(validateExpiredEvidence(envelope).ok, false);

  const plan = planConversation({
    intent: 'skin',
    envelope,
    route: routeCapability('skin'),
  });
  assert.equal(plan.answerStrategy, 'clarify');
  assert.equal(plan.primaryReasonCode, 'expired_evidence');
  assert.equal(plan.selectedClaimKeys.length, 0);

  const response = generateGroundedResponse({ plan, envelope });
  assert.equal(response.citedClaimKeys.length, 0);
  assert.ok(!response.answerAr.includes('قديم') || response.answerAr.includes('منتهية'));

  const turn = runAdvisorTurn({
    sessionId: 'sess_stale_turn',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: [staleUnit],
    now: NOW,
  });
  assert.notEqual(turn.plan.answerStrategy, 'grounded');
  assert.equal(turn.response.citedClaimKeys.length, 0);
  assert.equal(turn.validation.expiryOk, false);
  assert.ok(
    turn.runtime.status === 'waiting' || turn.runtime.status === 'clarification',
  );
  console.log('ok stale_never_grounded');
}

function testLaw34Grounding(): void {
  const envelope = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_law34',
    units: sampleSkinUnits(),
    now: NOW,
  });
  const plan = planConversation({
    intent: 'skin',
    envelope,
    route: routeCapability('skin'),
  });
  const response = generateGroundedResponse({ plan, envelope });
  assert.equal(response.law34Compliant, true);
  assertLaw34(envelope, response);
  const forged = {
    ...response,
    citedClaimKeys: ['invented.score'],
    citationIds: ['fake'],
    law34Compliant: true,
  };
  assert.equal(validateLaw34Response(envelope, forged).ok, false);
  console.log('ok law34');
}

function testFalseAttributionRejected(): void {
  const bad = makeEvidenceUnit({
    subsystemId: 'outfit_intelligence',
    claimKey: 'fake.outfit',
    statementAr: 'legacy lie',
    confidence: 'medium',
    provenance: 'mce_legacy_summary',
    now: NOW,
  });
  assert.throws(() =>
    sealAdvisorEvidenceEnvelope({
      sessionId: 'sess_bad',
      units: [bad],
      now: NOW,
    }),
  );
  const check = validateEnvelopeProvenance([
    {
      subsystemId: 'styling_intelligence',
      provenance: 'mce_legacy_summary',
      claimKey: 'x',
    },
  ]);
  assert.equal(check.ok, false);
  console.log('ok provenance');
}

function testProjectorAttribution(): void {
  const snapshot: MceContextSnapshotV1 = {
    schemaVersion: '1.0.0',
    builtAt: NOW,
    user: {
      locale: 'ar',
      isMinor: false,
      subscriptionPlan: 'free',
      statedGoalAr: 'أناقة',
    },
    skin: {
      analysisId: 'skin_abc',
      beautyScore: 80,
      skinTypeAr: 'دهنية',
      headlineAr: 'بشرة تحتاج ترطيباً',
      summaryAdviceAr: 'رطّبي',
      mainConcerns: [{ id: 'pores', titleAr: 'مسام', severity: 'moderate' }],
      tipsAr: [],
      routineMorningAr: ['منظف'],
      routineEveningAr: ['مرطب'],
      concernScores: [],
      disclaimerAr: 'عام',
      isMinor: false,
    },
    outfit: {
      analysisId: 'out_1',
      occasionId: 'casual',
      compatibilityScore: 1,
      colorHarmonyScore: 1,
      occasionMatchScore: 1,
      analysisGate: 'ok',
      clothingTypeAr: 'كاجوال',
      styleTypeAr: 'بسيط',
      dominantColorsAr: ['أسود'],
      recommendedColorsAr: [],
      rejectedColorsAr: [],
      styleVerdictAr: 'إطلالة مقبولة',
      matchReasonsAr: [],
      mismatchReasonsAr: [],
      disclaimerAr: 'عام',
    },
  };
  const units = projectMceSnapshotToEvidenceUnits(snapshot, NOW);
  assert.ok(units.some((u) => u.subsystemId === 'skin_intelligence'));
  assert.ok(units.every((u) => u.subsystemId !== 'outfit_intelligence'));
  assert.ok(units.every((u) => u.subsystemId !== 'styling_intelligence'));
  assert.ok(units.some((u) => u.subsystemId === 'unknown'));
  sealAdvisorEvidenceEnvelope({ sessionId: 'sess_proj', units, now: NOW });
  console.log('ok projector_attribution');
}

function testConversationMultiTurn(): void {
  const first = runAdvisorTurn({
    sessionId: 'sess_mt',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: sampleSkinUnits(),
    now: NOW,
  });
  assert.equal(first.runtime.status, 'completed');
  assert.ok(first.sessionMemory.boundEvidenceRefs.length > 0);

  const second = runAdvisorTurn({
    sessionId: 'sess_mt',
    message: 'وما الروتين؟',
    evidenceUnits: sampleSkinUnits(),
    conversationState: first.conversationState,
    conversationMemory: first.conversationMemory,
    sessionMemory: first.sessionMemory,
    memoryRefs: first.memoryRefs,
    now: '2026-07-19T00:00:01.000Z',
  });
  assert.equal(second.conversationState.turnIndex, 2);
  console.log('ok conversation');
}

function testFacadeMultiTurn(): void {
  const svc = new BeautyAdvisorService();
  svc.clearSession('facade_sess');
  const a = svc.turn({
    sessionId: 'facade_sess',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: sampleSkinUnits(),
    persistSession: true,
  });
  const b = svc.turn({
    sessionId: 'facade_sess',
    message: 'وما الروتين؟',
    evidenceUnits: sampleSkinUnits(),
    persistSession: true,
  });
  assert.equal(a.conversationState.turnIndex, 1);
  assert.equal(b.conversationState.turnIndex, 2);
  assert.equal(svc.getSessionTurnCount('facade_sess'), 2);
  console.log('ok facade_multiturn');
}

function testMissingEvidenceClarification(): void {
  const turn = runAdvisorTurn({
    sessionId: 'sess_miss',
    message: 'ما أسلوب إطلالي؟',
    evidenceUnits: [],
    now: NOW,
  });
  assert.equal(turn.plan.primaryReasonCode, 'missing_evidence');
  assert.equal(turn.response.citedClaimKeys.length, 0);
  console.log('ok missing_evidence');
}

function testUnsupportedAndBlocked(): void {
  const shop = runAdvisorTurn({
    sessionId: 'sess_shop',
    message: 'أريد شراء من السوق',
    evidenceUnits: sampleSkinUnits(),
    now: NOW,
  });
  assert.equal(shop.runtime.status, 'unsupported');

  const blocked = runAdvisorTurn({
    sessionId: 'sess_block',
    message: 'أعطني تشخيص طبي',
    now: NOW,
  });
  assert.equal(blocked.runtime.status, 'blocked');

  const forced = runAdvisorTurn({
    sessionId: 'sess_force',
    message: 'hello',
    forceBlocked: true,
    now: NOW,
  });
  assert.equal(forced.intent, 'blocked');
  console.log('ok safety');
}

function testMemoryRefsOnly(): void {
  const bundle = createAdvisorMemoryBundle('sess_mem');
  const next = appendConversationTurn(bundle.conversation, {
    role: 'user',
    textAr: 'مرحبا',
    at: NOW,
  });
  assert.equal(next.turns.length, 1);
  const refs = evolveMemoryRefs(bundle.refs, {
    goalRefs: ['style_goal_ref_1'],
    lastEnvelopeId: 'aenv_x',
  });
  assert.equal(refs.lastEnvelopeId, 'aenv_x');
  console.log('ok memory');
}

function testDeterminismGolden(): void {
  const a = runAdvisorTurn({
    sessionId: 'sess_det',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: sampleSkinUnits(),
    now: NOW,
  });
  const b = runAdvisorTurn({
    sessionId: 'sess_det',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: sampleSkinUnits(),
    now: NOW,
  });
  assert.equal(a.envelope.envelopeId, b.envelope.envelopeId);
  assert.equal(a.response.answerAr, b.response.answerAr);
  assert.equal(a.runtime.traceId, b.runtime.traceId);
  assert.equal(a.plan.answerStrategy, b.plan.answerStrategy);
  console.log('ok determinism');
}

function testServiceFacade(): void {
  const svc = new BeautyAdvisorService();
  const result = svc.turn({
    sessionId: 'sess_svc',
    message: 'ما نوع بشرتي؟',
    evidenceUnits: sampleSkinUnits(),
    persistSession: false,
  });
  assert.equal(result.validation.law34Ok, true);
  assert.ok(result.runtime.retryable === false || typeof result.runtime.retryable === 'boolean');
  assert.ok(result.envelope.forbiddenClaims.length >= DEFAULT_FORBIDDEN_CLAIMS.length);
  console.log('ok service');
}

function testDeepFreeze(): void {
  const envelope = sealAdvisorEvidenceEnvelope({
    sessionId: 'sess_freeze',
    units: sampleSkinUnits(),
    now: NOW,
  });
  assert.throws(() => {
    (envelope as { sealedAt: string }).sealedAt = 'x';
  });
  console.log('ok deep_freeze');
}

function main(): void {
  testVersions();
  testEnvelopeSeal();
  testIntentAndRouting();
  testPlannerEnvelopeOnly();
  testStaleNeverGrounded();
  testLaw34Grounding();
  testFalseAttributionRejected();
  testProjectorAttribution();
  testConversationMultiTurn();
  testFacadeMultiTurn();
  testMissingEvidenceClarification();
  testUnsupportedAndBlocked();
  testMemoryRefsOnly();
  testDeterminismGolden();
  testServiceFacade();
  testDeepFreeze();
  console.log('phase7b.2 beauty advisor freeze OK');
}

main();
