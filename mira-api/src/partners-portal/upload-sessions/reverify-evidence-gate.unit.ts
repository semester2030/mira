/**
 * Tests the SAME verifyR2EvidenceDocument used by REVERIFY (via verify-r2-evidence.ts).
 */
import assert from 'node:assert/strict';
import {
  judgeAbortRead,
  judgeR2Acceptance,
  REQUIRED_MIRA_STEPS,
  verifyR2EvidenceDocument,
} from './r2-acceptance-gate';

function allMiraOk() {
  return REQUIRED_MIRA_STEPS.map((id) => ({ id, ok: true as const }));
}

const base = {
  commit: 'abc123',
  startedUtc: '2026-11-05T14:00:05.000Z',
  runId: 'run-1',
};

{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      ok: true,
      steps: [{ id: 'R2_SUITE', ok: true }, { id: 'R2_MIRA_APP_PATH', ok: true }, ...allMiraOk()],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'PASS');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: { ...base, ok: true, steps: [] },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
  assert.equal(v.reason, 'ok-true-with-empty-steps');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      ok: true,
      steps: [{ id: 'R2_SUITE', ok: true }, { id: 'R2_MIRA_READY', ok: false }, ...allMiraOk()],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      ok: false,
      blocked: true,
      steps: [
        { id: 'R2_SUITE', ok: true },
        { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' },
        { id: 'R2_MIRA_READY', ok: false },
      ],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
  assert.equal(v.reason, 'blocked-conflicts-with-executed-failure');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: { ...base, commit: 'unknown', ok: false, blocked: true, steps: [{ id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' }] },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      startedUtc: '2026-11-05T13:00:00.000Z',
      ok: false,
      blocked: true,
      steps: [{ id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' }],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
  assert.equal(v.reason, 'stale-or-unparseable-time');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      runId: 'other',
      ok: false,
      blocked: true,
      steps: [{ id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' }],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
    expectedRunId: 'run-1',
  });
  assert.equal(v.verdict, 'FAIL');
  assert.equal(v.reason, 'runId-mismatch');
}
{
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      ok: false,
      blocked: true,
      steps: [{ id: 'ENV', ok: 'BLOCKED' }, { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' }],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'BLOCKED');
}
{
  // Missing required MIRA step → not PASS even if summary.ok true
  const v = verifyR2EvidenceDocument({
    evidence: {
      ...base,
      ok: true,
      steps: [{ id: 'R2_SUITE', ok: true }, { id: 'R2_MIRA_APP_PATH', ok: true }],
    },
    testedCommit: 'abc123',
    runStartedIso: '2026-11-05T14:00:00.000Z',
    exitCode: 0,
  });
  assert.equal(v.verdict, 'FAIL');
}
{
  const bad = judgeAbortRead({
    responseStatus: 200,
    receivedBytes: 384,
    expectedTotalBytes: 384,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: false,
    followUpFullOk: true,
  });
  assert.equal(bad.ok, false);
  const bad503 = judgeAbortRead({
    responseStatus: 503,
    receivedBytes: 10,
    expectedTotalBytes: 384,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: true,
    followUpFullOk: true,
  });
  assert.equal(bad503.ok, false);
  const good = judgeAbortRead({
    responseStatus: 200,
    receivedBytes: 64,
    expectedTotalBytes: 384,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: true,
    followUpFullOk: true,
  });
  assert.equal(good.ok, true);
}
{
  // judge itself: failed step not hidden as blocked
  const j = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' },
    { id: 'R2_MIRA_READY', ok: false },
  ]);
  assert.equal(j.blocked, false);
  assert.equal(j.ok, false);
}

console.log(JSON.stringify({ ok: true, id: 'REVERIFY_EVIDENCE_GATE_UNIT' }));
