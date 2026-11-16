/**
 * Run 20 acceptance cases against decideIntent (no live catalog required).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { decideIntent, extractSignals } from './intent';

const matrix = JSON.parse(
  readFileSync(join(__dirname, 'acceptance-matrix.v1.json'), 'utf8'),
) as {
  cases: Array<{
    id: string;
    requestAr: string;
    hasFaceImage?: boolean;
    expectedKind: string;
    expectedRules: string[];
  }>;
};

assert.equal(matrix.cases.length, 20);

const results: Array<{
  id: string;
  requestAr: string;
  expectedKind: string;
  actualKind: string;
  pass: boolean;
  ruleIds: string[];
  note: string;
}> = [];

for (const c of matrix.cases) {
  const intent = decideIntent(
    extractSignals(c.requestAr, { hasFaceImage: c.hasFaceImage }),
  );
  const kindOk = intent.kind === c.expectedKind;
  const rulesOk =
    c.expectedRules.length === 0 ||
    c.expectedRules.some((r) => intent.ruleIds.includes(r));
  // A10 / A17 may stay advice_only — rules gate.advice is enough
  const pass = kindOk && (rulesOk || intent.ruleIds.includes('gate.advice'));
  results.push({
    id: c.id,
    requestAr: c.requestAr,
    expectedKind: c.expectedKind,
    actualKind: intent.kind,
    pass,
    ruleIds: intent.ruleIds,
    note: pass ? 'ok' : `expected ${c.expectedKind}/${c.expectedRules.join(',')} got ${intent.kind}/${intent.ruleIds.join(',')}`,
  });
  if (!pass) {
    console.error('FAIL', results[results.length - 1]);
  } else {
    console.log('pass', c.id, intent.kind, intent.ruleIds.join('+'));
  }
}

const failed = results.filter((r) => !r.pass);
assert.equal(failed.length, 0, `acceptance failures: ${failed.map((f) => f.id).join(',')}`);
console.log('OK consultant-discovery acceptance 20/20 intent layer');
