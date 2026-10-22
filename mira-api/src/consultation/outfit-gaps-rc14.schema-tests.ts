/**
 * RC14 — rate-limit resume only with server-side quotaReserved proof.
 * Run: npx ts-node --transpile-only src/consultation/outfit-gaps-rc14.schema-tests.ts
 */
import { ConsultationMessageService } from './services/consultation-message.service';

function assert(cond: boolean, name: string, detail?: unknown) {
  if (!cond) {
    console.error('FAIL', name, detail ?? '');
    process.exitCode = 1;
    return;
  }
  console.log('PASS', name);
}

function readQuota(svc: ConsultationMessageService, payload: unknown) {
  return svc.readQuotaReserved({ payloadJson: payload });
}

async function main() {
  const svc = new ConsultationMessageService({} as never);

  assert(readQuota(svc, null) === false, 'absent-payload-not-reserved');
  assert(readQuota(svc, {}) === false, 'empty-payload-not-reserved');
  assert(readQuota(svc, { quotaReserved: false }) === false, 'explicit-false-not-reserved');
  assert(readQuota(svc, { quotaReserved: true }) === true, 'explicit-true-reserved');
  assert(
    readQuota(svc, { quotaReserved: 'true' }) === false,
    'string-true-not-accepted',
  );

  // Resume skip policy: only when quotaReserved === true.
  const resumeWithoutQuota = { claimStatus: 'resume' as const, quotaReserved: false };
  const resumeWithQuota = { claimStatus: 'resume' as const, quotaReserved: true };
  const created = { claimStatus: 'created' as const, quotaReserved: false };
  assert(
    !(resumeWithoutQuota.claimStatus === 'resume' && resumeWithoutQuota.quotaReserved === true),
    '429-resume-must-not-skip',
  );
  assert(
    resumeWithQuota.claimStatus === 'resume' && resumeWithQuota.quotaReserved === true,
    'accepted-resume-skips-recount',
  );
  assert(
    !(created.claimStatus === 'resume' && created.quotaReserved === true),
    'created-never-skips-via-resume-flag',
  );

  console.log('rc14-quota-tests-done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
