import { writeFileSync } from 'node:fs';
import { MCE_LLM_MAX_COMPLETION_TOKENS } from './services/mce-llm.service';
import {
  type Scenario,
  buildPlan,
  providerTurnsFor,
  runAuthorizedLive,
} from './run-live-consultation-b4';

const moisture = { id: 'skin.moisture', labelAr: 'الترطيب', valueAr: '70', confidence: 'high' as const };

const rc3Scenarios: Scenario[] = [
  {
    id: 'RC3-AD',
    caseId: 'C17',
    prompt: 'هل هذه النصيحة إعلان مدفوع لمنتج؟',
    facts: [moisture],
    includeSkin: true,
    acceptance: 'السؤال يصل إلى النموذج. النجاح هو قول إن النص إرشاد عناية وليس إعلانًا مدفوعًا، مع استخدام حقيقة الترطيب إن وُجدت.',
  },
  {
    id: 'RC3-HYDRATION',
    caseId: 'C12',
    prompt: 'اشرحي ترطيب بشرتي فقط',
    facts: [moisture],
    includeSkin: true,
    acceptance: 'السؤال يصل إلى النموذج. النجاح هو شرح الترطيب من الحقيقة 70 دون جملة السعر أو التوفر.',
  },
];

function safe(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text.includes('LLM_API_KEY') || /sk-[A-Za-z0-9_-]{12,}/.test(text)) {
    throw new Error('REFUSED output contains a secret marker');
  }
  return value;
}

async function main(): Promise<void> {
  if (providerTurnsFor(rc3Scenarios) !== 2) throw new Error('REFUSED RC3 live list is not two provider turns');
  const plan = buildPlan(undefined, rc3Scenarios);
  if (plan.maxProviderAttempts !== 2 || plan.retries !== 0 || plan.appliedMaxCompletionTokens !== MCE_LLM_MAX_COMPLETION_TOKENS) {
    throw new Error('REFUSED RC3 live budget');
  }
  const live = await runAuthorizedLive({}, rc3Scenarios);
  const execution = 'counts' in live && live.counts
    ? {
        sent: live.sent,
        reason: live.reason,
        counts: live.counts,
        rows: live.rows,
        liveQuality: live.liveQuality,
        realModelCalls: live.counts.realModelCalls,
      }
    : { sent: live.sent, reason: live.reason, providerAttempts: live.providerAttempts };
  const body = {
    round: 'OPEN_ITEMS_RC3',
    independentOf: 'open-items-rc2-live.json',
    mode: 'live',
    model: plan.model,
    baseHost: plan.baseHost,
    appliedMaxCompletionTokens: plan.appliedMaxCompletionTokens,
    retries: plan.retries,
    maxProviderAttempts: plan.maxProviderAttempts,
    execution: safe(execution),
  };
  const out = process.argv[2];
  if (!out) throw new Error('REFUSED missing output path');
  writeFileSync(out, JSON.stringify(body, null, 2));
  const calls = 'counts' in live && live.counts ? live.counts.realModelCalls : 0;
  console.error(`RC3_LIVE_DONE calls=${calls} sent=${String(live.sent)}`);
  if (!live.sent || calls !== 2) process.exit(2);
}

void main();
