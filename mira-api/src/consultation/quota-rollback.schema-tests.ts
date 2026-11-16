/**
 * Quota/rate rejects must roll the Redis counter back so retries do not dig deeper.
 */
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { RateLimitService } from '../common/services/rate-limit.service';
import { MceCostGuardService } from './services/mce-cost-guard.service';

class MemoryRedis {
  counts = new Map<string, number>();
  async incrementRateLimit(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async decrementRateLimit(key: string): Promise<void> {
    const next = (this.counts.get(key) ?? 0) - 1;
    this.counts.set(key, Math.max(0, next));
  }
}

function config(values: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string, fallback?: T) =>
      (values[key] as T | undefined) ?? (fallback as T),
  } as never;
}

async function main() {
  const redis = new MemoryRedis();
  const rate = new RateLimitService(redis as never, config({ RATE_LIMIT_PER_HOUR: 2 }));
  await rate.assertWithinLimit('u1', 'consultation-message');
  await rate.assertWithinLimit('u1', 'consultation-message');
  await assert.rejects(
    () => rate.assertWithinLimit('u1', 'consultation-message'),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
  assert.equal(redis.counts.get('rate:consultation-message:u1'), 2, 'rate-rollback');

  const guard = new MceCostGuardService(redis as never, config({ MCE_DAILY_LIMIT: 2 }));
  await guard.assertDailyQuota('u1', 'free');
  await guard.assertDailyQuota('u1', 'free');
  await assert.rejects(
    () => guard.assertDailyQuota('u1', 'free'),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(redis.counts.get(`mce:daily:v2:u1:${day}`), 2, 'daily-rollback');
  console.log('quota-rollback-tests-done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
