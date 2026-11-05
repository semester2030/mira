/**
 * Local decision tests for R2 acceptance gate — SDK-only / missing MIRA steps must not PASS.
 */
import assert from 'node:assert/strict';
import { judgeR2Acceptance, REQUIRED_MIRA_STEPS } from './r2-acceptance-gate';

function miraPassSteps() {
  return REQUIRED_MIRA_STEPS.map((id) => ({ id, ok: true as const }));
}

{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_SDK_DIAGNOSTIC', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.blocked, true);
  assert.equal(r.detail, 'MIRA_APP_PATH_BLOCKED');
}

{
  // Base present historically skipped MIRA steps — must FAIL, not PASS.
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_SDK_DIAGNOSTIC', ok: true },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.blocked, false);
  assert.ok(r.failed.includes('MIRA_STEPS_INCOMPLETE'));
}

{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: false },
    ...miraPassSteps().slice(0, 3),
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.blocked, false);
}

{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: true },
    ...miraPassSteps(),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.blocked, false);
  assert.equal(r.detail, 'PASS');
}

{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: false },
    { id: 'R2_MIRA_CREATE_SESSION', ok: false },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.blocked, false);
}

console.log(JSON.stringify({ ok: true, id: 'R2_MIRA_GATE_UNIT', required: REQUIRED_MIRA_STEPS.length }));
