import type { AdvisorEvidenceEnvelope } from '../contracts/advisor-evidence-envelope';
import type { ConversationPlan } from '../contracts/planner-contracts';
import type { AdvisorConfidence } from '../contracts/advisor-evidence-envelope';

export interface GroundedAdvisorResponse {
  answerAr: string;
  citedClaimKeys: string[];
  citationIds: string[];
  suggestedQuestionsAr: string[];
  confidence: AdvisorConfidence;
  blocked: boolean;
  disclaimerAr: string;
  law34Compliant: boolean;
}

export const ADVISOR_DISCLAIMER_AR =
  'نصيحة عناية عامة من ميرا — ليست تشخيصاً طبياً ولا وصفة علاجية. تعتمد الإجابة فقط على أدلة ظرف المستشارة.';

function computeLaw34Flag(
  envelope: AdvisorEvidenceEnvelope,
  citedClaimKeys: string[],
  citationIds: string[],
): boolean {
  for (const key of citedClaimKeys) {
    if (!envelope.allowedClaims.includes(key)) return false;
    if (envelope.forbiddenClaims.includes(key)) return false;
    if (!envelope.claims[key]) return false;
  }
  for (const cid of citationIds) {
    if (!envelope.citations.some((c) => c.citationId === cid)) return false;
  }
  return true;
}

/**
 * Grounded Response Engine — speaks ONLY from envelope claims (Law #34).
 * Never invents scores, analysis, or recommendations.
 */
export function generateGroundedResponse(input: {
  plan: ConversationPlan;
  envelope: AdvisorEvidenceEnvelope;
}): GroundedAdvisorResponse {
  const { plan, envelope } = input;

  const finish = (
    partial: Omit<GroundedAdvisorResponse, 'law34Compliant'>,
  ): GroundedAdvisorResponse => ({
    ...partial,
    law34Compliant: computeLaw34Flag(
      envelope,
      partial.citedClaimKeys,
      partial.citationIds,
    ),
  });

  if (plan.answerStrategy === 'refuse' || plan.answerStrategy === 'unsupported') {
    const refuseStep = plan.steps.find(
      (s) => s.kind === 'refuse' || s.kind === 'clarify',
    );
    return finish({
      answerAr:
        refuseStep?.clarificationAr ??
        'لا أستطيع الإجابة على هذا الطلب ضمن نطاق مستشارة الجمال.',
      citedClaimKeys: [],
      citationIds: [],
      suggestedQuestionsAr: plan.followUpsAr,
      confidence: 'high',
      blocked: plan.answerStrategy === 'refuse' && plan.intent === 'blocked',
      disclaimerAr: ADVISOR_DISCLAIMER_AR,
    });
  }

  if (plan.answerStrategy === 'clarify') {
    const clarify = plan.steps.find((s) => s.kind === 'clarify');
    return finish({
      answerAr:
        clarify?.clarificationAr ??
        'لا تتوفر أدلة كافية في ظرف المستشارة للإجابة. يرجى ربط تحليل مجمّد.',
      citedClaimKeys: [],
      citationIds: [],
      suggestedQuestionsAr: plan.followUpsAr,
      confidence: 'low',
      blocked: false,
      disclaimerAr: ADVISOR_DISCLAIMER_AR,
    });
  }

  /** Hard stop — never narrate stale as current. */
  if (envelope.freshness.stale) {
    return finish({
      answerAr:
        'الأدلة منتهية الصلاحية. لن أسرد نتائج قديمة كحقائق حالية. حدّثي التحليل ثم أعيدي السؤال.',
      citedClaimKeys: [],
      citationIds: [],
      suggestedQuestionsAr: plan.followUpsAr,
      confidence: 'low',
      blocked: false,
      disclaimerAr: ADVISOR_DISCLAIMER_AR,
    });
  }

  const keys = plan.selectedClaimKeys.filter((k) =>
    envelope.allowedClaims.includes(k),
  );
  const statements: string[] = [];
  const citationIds: string[] = [];
  const citedClaimKeys: string[] = [];

  for (const key of keys) {
    if (envelope.forbiddenClaims.includes(key)) {
      continue;
    }
    const claim = envelope.claims[key];
    if (!claim) continue;
    statements.push(claim.statementAr);
    citationIds.push(claim.citationId);
    citedClaimKeys.push(key);
  }

  if (statements.length === 0) {
    return finish({
      answerAr:
        'لا توجد ادعاءات مسموحة داخل ظرف المستشارة لهذا السؤال. لم أخترع أي نتيجة.',
      citedClaimKeys: [],
      citationIds: [],
      suggestedQuestionsAr: plan.followUpsAr,
      confidence: 'low',
      blocked: false,
      disclaimerAr: ADVISOR_DISCLAIMER_AR,
    });
  }

  const limitationNote =
    envelope.limitations.length > 0
      ? `\n\nقيود: ${envelope.limitations.join(' · ')}`
      : '';

  const answerAr = `بناءً على الأدلة المتوفرة في ظرف المستشارة:\n${statements
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n')}${limitationNote}`;

  return finish({
    answerAr,
    citedClaimKeys,
    citationIds,
    suggestedQuestionsAr: plan.followUpsAr,
    confidence: envelope.confidence,
    blocked: false,
    disclaimerAr: ADVISOR_DISCLAIMER_AR,
  });
}
