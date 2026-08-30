import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import {
  RedisCriticalControlUnavailableError,
  RedisService,
} from './redis.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { MceCostGuardService } from '../consultation/services/mce-cost-guard.service';

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (key in values ? values[key] : fallback) as T,
  } as ConfigService;
}

class ControlledRedisService extends RedisService {
  constructor(private readonly fakeClient: unknown) {
    super(config({ REDIS_URL: 'test-only-configured-marker' }));
  }

  protected override getClient(): any {
    return this.fakeClient;
  }
}

async function testMissingRedisFailsClosed(): Promise<void> {
  const redis = new RedisService(config());
  await assert.rejects(
    () => redis.incrementRateLimit('critical:test', 60),
    RedisCriticalControlUnavailableError,
  );
  assert.deepEqual(redis.runtimeStatus(), {
    configured: false,
    state: 'UNAVAILABLE',
    criticalControls: 'fail_closed',
    optionalCache: 'fail_open',
  });
}

async function testConnectionAndPartialCounterFailuresFailClosed(): Promise<void> {
  for (const fakeClient of [
    { incr: async () => Promise.reject(new Error('connect timeout')) },
    {
      incr: async () => 1,
      expire: async () => Promise.reject(new Error('partial expire failure')),
    },
  ]) {
    const redis = new ControlledRedisService(fakeClient);
    await assert.rejects(
      () => redis.incrementRateLimit('critical:test', 60),
      RedisCriticalControlUnavailableError,
    );
  }
}

async function testHttpGuardsMapUnavailableAndPreserve429(): Promise<void> {
  const unavailable = {
    incrementRateLimit: async () => {
      throw new RedisCriticalControlUnavailableError();
    },
  } as unknown as RedisService;

  const rateLimit = new RateLimitService(
    unavailable,
    config({ RATE_LIMIT_PER_HOUR: 30 }),
  );
  await assert.rejects(
    () => rateLimit.assertWithinLimit('user', 'skin'),
    (error: unknown) =>
      error instanceof ServiceUnavailableException &&
      (error.getResponse() as { code?: string }).code ===
        'RATE_LIMIT_UNAVAILABLE',
  );

  const mce = new MceCostGuardService(unavailable, config());
  await assert.rejects(
    () => mce.assertDailyQuota('user', 'free'),
    (error: unknown) =>
      error instanceof ServiceUnavailableException &&
      (error.getResponse() as { code?: string }).code ===
        'MCE_QUOTA_UNAVAILABLE',
  );

  const exceeded = new RateLimitService(
    { incrementRateLimit: async () => 31 } as unknown as RedisService,
    config({ RATE_LIMIT_PER_HOUR: 30 }),
  );
  await assert.rejects(
    () => exceeded.assertWithinLimit('user', 'skin'),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
}

async function testOptionalFaqCacheStillFailsOpen(): Promise<void> {
  const redis = new ControlledRedisService({
    get: async () => Promise.reject(new Error('cache read unavailable')),
    set: async () => Promise.reject(new Error('cache write unavailable')),
  });
  assert.equal(await redis.getJson('faq:test'), null);
  await redis.setJson('faq:test', { safe: true }, 60);
}

function testHealthIsNonSecretAndCanonicalRoutesAreGuarded(): void {
  const redis = new RedisService(
    config({ REDIS_URL: 'test-only-sensitive-marker' }),
  );
  const healthJson = JSON.stringify(redis.runtimeStatus());
  assert.equal(healthJson.includes('test-only-sensitive-marker'), false);
  assert.equal(healthJson.includes('REDIS_URL'), false);

  const controller = readFileSync(
    'src/ai/ai-gateway.controller.ts',
    'utf8',
  );
  for (const action of [
    'fashion_segmentation',
    'fashion_analysis',
    'fashion_recolor',
  ]) {
    assert.match(
      controller,
      new RegExp(
        `assertWithinLimit\\([\\s\\n]*user\\.firebaseUid,[\\s\\n]*'${action}'`,
      ),
    );
  }
}

async function main(): Promise<void> {
  await testMissingRedisFailsClosed();
  await testConnectionAndPartialCounterFailuresFailClosed();
  await testHttpGuardsMapUnavailableAndPreserve429();
  await testOptionalFaqCacheStillFailsOpen();
  testHealthIsNonSecretAndCanonicalRoutesAreGuarded();
  console.log('phase3b-redis-critical-controls: PASS');
}

void main();
