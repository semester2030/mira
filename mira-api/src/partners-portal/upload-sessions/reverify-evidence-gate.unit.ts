/**
 * Proves REVERIFY evidence integrity rules reject stale/unknown/mismatched commits.
 * Pure logic mirror of scripts/p2-p31-final-REVERIFY.sh checks.
 */
import assert from 'node:assert/strict';

function judgeEvidenceCommit(evCommit: string, tested: string): { ok: boolean; reason: string } {
  const c = String(evCommit || '').trim();
  const t = String(tested || '').trim();
  if (!c || c.toLowerCase() === 'unknown') return { ok: false, reason: 'missing-or-unknown' };
  if (!t) return { ok: false, reason: 'tested-missing' };
  if (c !== t) return { ok: false, reason: 'mismatch' };
  return { ok: true, reason: 'match' };
}

function judgeFreshness(evStartedIso: string, runStartedIso: string, skewSec = 2): { ok: boolean; reason: string } {
  if (!evStartedIso || !runStartedIso) return { ok: false, reason: 'missing-timestamps' };
  const ev = Date.parse(evStartedIso);
  const run = Date.parse(runStartedIso);
  if (Number.isNaN(ev) || Number.isNaN(run)) return { ok: false, reason: 'parse' };
  if (ev / 1000 + skewSec < run / 1000) return { ok: false, reason: 'stale' };
  return { ok: true, reason: 'fresh' };
}

{
  assert.equal(judgeEvidenceCommit('unknown', 'abc').ok, false);
  assert.equal(judgeEvidenceCommit('', 'abc').ok, false);
  assert.equal(judgeEvidenceCommit('abc', 'abc').ok, true);
  assert.equal(judgeEvidenceCommit('abc', 'def').reason, 'mismatch');
}
{
  const run = '2026-11-05T12:00:00.000Z';
  assert.equal(judgeFreshness('2026-11-05T11:59:00.000Z', run).ok, false);
  assert.equal(judgeFreshness('2026-11-05T12:00:01.000Z', run).ok, true);
  assert.equal(judgeFreshness('', run).ok, false);
}
{
  // Missing required step → not PASS (simulate)
  const steps = [{ id: 'R2_SUITE', ok: true }];
  const required = ['R2_MIRA_READY', 'R2_MIRA_BIND'];
  const complete = required.every((id) => steps.some((s) => s.id === id && s.ok === true));
  assert.equal(complete, false);
}

console.log(JSON.stringify({ ok: true, id: 'REVERIFY_EVIDENCE_GATE_UNIT' }));
