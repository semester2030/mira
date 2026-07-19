import type { AdvisorEvidenceEnvelope } from '../contracts/advisor-evidence-envelope';
import type { ConversationPlan, PlannerStep } from '../contracts/planner-contracts';
import type { AdvisorIntent } from '../contracts/conversation-state';
import type { CapabilityRoute } from '../routing/capability-router';
import { ADVISOR_PLANNER_VERSION } from '../release';

function claimKeysForSubsystems(
  envelope: AdvisorEvidenceEnvelope,
  subsystems: string[],
): string[] {
  if (subsystems.length === 0) {
    return [...envelope.allowedClaims];
  }
  return envelope.allowedClaims.filter((key) => {
    const claim = envelope.claims[key];
    return claim && subsystems.includes(claim.subsystemId);
  });
}

/**
 * Conversation Planner — consumes ONLY Advisor Evidence Envelope.
 * Never inspects frozen subsystem internals.
 */
export function planConversation(input: {
  intent: AdvisorIntent;
  envelope: AdvisorEvidenceEnvelope;
  route: CapabilityRoute;
}): ConversationPlan {
  const { intent, envelope, route } = input;
  const steps: PlannerStep[] = [];

  if (intent === 'blocked') {
    return {
      version: ADVISOR_PLANNER_VERSION,
      intent,
      steps: [
        {
          kind: 'refuse',
          reasonCode: 'blocked_safety',
          clarificationAr:
            'لا أقدّم تشخيصاً طبياً أو وصفات. يمكنني شرح نتائج تحليلك التجميلي المخزّنة فقط.',
        },
      ],
      selectedClaimKeys: [],
      followUpsAr: ['ما نوع بشرتي حسب التقرير؟', 'ما روتيني الصباحي؟'],
      primaryReasonCode: 'blocked_safety',
      answerStrategy: 'refuse',
    };
  }

  if (intent === 'unsupported' || !route.supported) {
    return {
      version: ADVISOR_PLANNER_VERSION,
      intent,
      steps: [
        {
          kind: 'refuse',
          reasonCode: 'unsupported_request',
          clarificationAr:
            'التسوّق والسوق خارج نطاق مستشارة الجمال. أستطيع شرح تقاريرك المجمّدة فقط.',
        },
      ],
      selectedClaimKeys: [],
      followUpsAr: ['لخّصي تقرير بشرتي', 'ما أسلوب إطلالي؟'],
      primaryReasonCode: 'unsupported_request',
      answerStrategy: 'unsupported',
    };
  }

  /** Critical #1 — stale evidence must never produce a grounded plan. */
  if (envelope.freshness.stale) {
    steps.push({
      kind: 'clarify',
      reasonCode: 'expired_evidence',
      clarificationAr:
        'الأدلة في ظرف المستشارة منتهية أو قديمة. حدّثي التحليل ثم أعيدي السؤال — لن أسرد نتائج قديمة كحقائق حالية.',
    });
    steps.push({
      kind: 'route_action',
      action: route.action,
      reasonCode: 'expired_evidence',
    });
    return {
      version: ADVISOR_PLANNER_VERSION,
      intent,
      steps,
      selectedClaimKeys: [],
      followUpsAr: [
        'حدّثي التحليل ثم اسألي مجدداً',
        route.action.reasonAr,
      ],
      primaryReasonCode: 'expired_evidence',
      answerStrategy: 'clarify',
    };
  }

  const selected = claimKeysForSubsystems(
    envelope,
    route.targetSubsystems,
  );

  if (selected.length === 0) {
    steps.push({
      kind: 'need_evidence',
      reasonCode: 'missing_evidence',
    });
    steps.push({
      kind: 'clarify',
      reasonCode: 'clarification_required',
      clarificationAr: route.action.reasonAr,
    });
    steps.push({
      kind: 'route_action',
      action: route.action,
      reasonCode: 'missing_evidence',
    });
    return {
      version: ADVISOR_PLANNER_VERSION,
      intent,
      steps,
      selectedClaimKeys: [],
      followUpsAr: [
        route.action.reasonAr,
        'هل تريدين ربط تحليل موجود؟',
      ],
      primaryReasonCode: 'missing_evidence',
      answerStrategy: 'clarify',
    };
  }

  steps.push({
    kind: 'select_evidence',
    claimKeys: selected,
    reasonCode: 'advisor_ok',
  });
  steps.push({
    kind: 'narrate',
    claimKeys: selected,
    reasonCode: 'advisor_ok',
  });

  if (intent === 'beauty_experience') {
    steps.push({
      kind: 'route_action',
      action: route.action,
      reasonCode: 'advisor_ok',
    });
  }

  const followUpsAr = selected.slice(0, 2).map((k) => {
    const c = envelope.claims[k];
    return c ? `أخبريني المزيد عن: ${c.statementAr.slice(0, 40)}` : 'ما التالي؟';
  });
  if (followUpsAr.length === 0) {
    followUpsAr.push('هل تريدين توضيحاً إضافياً؟');
  }

  const primary =
    envelope.confidence === 'low'
      ? ('low_confidence' as const)
      : ('advisor_ok' as const);

  return {
    version: ADVISOR_PLANNER_VERSION,
    intent,
    steps,
    selectedClaimKeys: selected,
    followUpsAr,
    primaryReasonCode: primary,
    answerStrategy: 'grounded',
  };
}
