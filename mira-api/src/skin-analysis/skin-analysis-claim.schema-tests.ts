/**
 * RC16 — skin analysis claim fingerprint + conflict rules (unit).
 * Run: npx ts-node --transpile-only src/skin-analysis/skin-analysis-claim.schema-tests.ts
 */
import { createHash } from 'crypto';
import { SkinAnalysisClaimService } from './skin-analysis-claim.service';

function assert(cond: boolean, name: string) {
  if (!cond) {
    console.error('FAIL', name);
    process.exitCode = 1;
    return;
  }
  console.log('PASS', name);
}

function main() {
  const svc = new SkinAnalysisClaimService({} as never);
  const a = Buffer.from([1, 2, 3, 4]);
  const b = Buffer.from([1, 2, 3, 5]);
  const fa = svc.fingerprint(a);
  const fb = svc.fingerprint(b);
  assert(fa !== fb, 'different-bytes-different-fingerprint');
  assert(fa === svc.fingerprint(a), 'stable-fingerprint');
  assert(
    svc.fingerprint(a, '{"v":1}') !== fa,
    'faceIntel-changes-fingerprint',
  );
  const expected = createHash('sha256').update(a).digest('hex');
  assert(fa === expected, 'matches-sha256-bytes-only');
  console.log('skin-analysis-claim.schema-tests: PASS');
}

main();
