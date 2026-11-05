/**
 * Unit proofs for R2 acceptance gate — mocks only; never counts as R2 PASS.
 */
import assert from 'node:assert/strict';
import {
  judgeR2Acceptance,
  judgeBindResult,
  judgeRangeResponse,
  mediaIdFromSessionBody,
  REQUIRED_MIRA_STEPS,
} from './r2-acceptance-gate';

function allMiraOk() {
  return REQUIRED_MIRA_STEPS.map((id) => ({ id, ok: true as const }));
}

{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' },
  ]);
  assert.equal(r.blocked, true);
  assert.equal(r.ok, false);
}
{
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: true },
    // missing REQUIRED_MIRA_STEPS
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.blocked, false);
  assert.ok(r.failed.includes('MIRA_STEPS_INCOMPLETE'));
}
{
  const r = judgeR2Acceptance([{ id: 'R2_SUITE', ok: true }, { id: 'R2_MIRA_APP_PATH', ok: true }, ...allMiraOk()]);
  assert.equal(r.ok, true);
}
{
  // SDK-only must never PASS
  const r = judgeR2Acceptance([{ id: 'R2_SUITE', ok: true }]);
  assert.equal(r.ok, false);
}
{
  // Invalid base / failed step
  const r = judgeR2Acceptance([
    { id: 'R2_SUITE', ok: true },
    { id: 'R2_MIRA_APP_PATH', ok: false },
    ...allMiraOk(),
  ]);
  assert.equal(r.ok, false);
}
{
  // catalogMediaId contract — mediaId alone is not enough
  assert.equal(mediaIdFromSessionBody({ status: 'ready', mediaId: 'legacy' }), null);
  assert.equal(mediaIdFromSessionBody({ status: 'ready', catalogMediaId: 'm1' }), 'm1');
  assert.equal(mediaIdFromSessionBody({ status: 'uploading', catalogMediaId: 'm1' }), null);
}
{
  const bad409 = judgeBindResult({
    httpOk: false,
    status: 409,
    mediaId: 'm1',
    ownerId: 'o1',
    final: null,
  });
  assert.equal(bad409.ok, false);
  const ok409 = judgeBindResult({
    httpOk: false,
    status: 409,
    mediaId: 'm1',
    ownerId: 'o1',
    final: { id: 'm1', ownerId: 'o1', draftIsPrimary: true },
  });
  assert.equal(ok409.ok, true);
}
{
  const file = Buffer.from('0123456789ABCDEFGHIJ');
  const good = judgeRangeResponse({
    status: 206,
    contentRange: 'bytes 0-15/20',
    contentLengthHeader: '16',
    body: file.subarray(0, 16),
    expectedFile: file,
    start: 0,
    end: 15,
  });
  assert.equal(good.ok, true);

  const short = judgeRangeResponse({
    status: 206,
    contentRange: 'bytes 0-15/20',
    contentLengthHeader: '16',
    body: file.subarray(0, 8),
    expectedFile: file,
    start: 0,
    end: 15,
  });
  assert.equal(short.ok, false);

  const badHeader = judgeRangeResponse({
    status: 206,
    contentRange: 'bytes 0-7/20',
    contentLengthHeader: '16',
    body: file.subarray(0, 16),
    expectedFile: file,
    start: 0,
    end: 15,
  });
  assert.equal(badHeader.ok, false);

  const errDoc = judgeRangeResponse({
    status: 503,
    contentRange: null,
    contentLengthHeader: '20',
    body: Buffer.from('{"error":"unavailable"}'),
    expectedFile: file,
    start: 0,
    end: 15,
  });
  assert.equal(errDoc.ok, false);
}

console.log(JSON.stringify({ ok: true, id: 'R2_MIRA_GATE_UNIT', required: REQUIRED_MIRA_STEPS.length }));
