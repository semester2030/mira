import assert from 'node:assert/strict';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  degradedGeometryStub,
  isFashnQuotaOrUnavailable,
} from './vision-orchestrator.service';

/**
 * Degraded geometry + FASHN quota detection — used when FASHN is out of credits.
 * Run: npm run test:vision-degraded
 */
export function runDegradedGeometryTests(): void {
  const g = degradedGeometryStub();
  assert.equal(g.segments.length, 1);
  assert.equal(g.segments[0].regionRole, 'full_body');
  assert.ok(g.segments[0].bbox.w > 0.5);
  assert.ok(g.segments[0].bbox.h > 0.5);
  assert.equal(g.topology.silhouetteHint, 'unknown');

  assert.equal(
    isFashnQuotaOrUnavailable(
      new ServiceUnavailableException({
        code: 'FASHN_QUOTA_EXCEEDED',
        message: 'HTTP 429 You are out of credits',
      }),
    ),
    true,
  );
  assert.equal(
    isFashnQuotaOrUnavailable(
      new ServiceUnavailableException({
        code: 'FASHN_NOT_CONFIGURED',
        message: 'missing key',
      }),
    ),
    true,
  );
  assert.equal(
    isFashnQuotaOrUnavailable(new Error('HTTP 429 rate limit')),
    true,
  );
  assert.equal(
    isFashnQuotaOrUnavailable(new Error('unrelated failure')),
    false,
  );

  console.log('degraded-geometry.schema-tests: OK');
}

if (require.main === module) {
  runDegradedGeometryTests();
}
