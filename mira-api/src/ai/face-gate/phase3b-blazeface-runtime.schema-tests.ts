import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  BLAZEFACE_MODEL_SOURCE,
  BLAZEFACE_MODEL_VERSION,
  BLAZEFACE_PACKAGE_VERSION,
  BlazeFacePresenceDetector,
} from './blazeface-face-presence.detector';

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (key in values ? values[key] : fallback) as T,
  } as ConfigService;
}

class ControlledDetector extends BlazeFacePresenceDetector {
  loads = 0;

  constructor(
    cfg: ConfigService,
    private readonly result: 'success' | 'failure' | 'hang',
  ) {
    super(cfg);
  }

  protected override async loadModel(): Promise<any> {
    this.loads += 1;
    if (this.result === 'failure') throw new Error('simulated offline model');
    if (this.result === 'hang') return new Promise(() => undefined);
    return { dispose: () => undefined };
  }
}

async function testProductionStartupPreloadAndMetadata(): Promise<void> {
  const detector = new ControlledDetector(
    config({
      NODE_ENV: 'production',
      BLAZEFACE_MODEL_LOAD_TIMEOUT_MS: '50',
    }),
    'success',
  );
  await detector.onModuleInit();
  assert.equal(detector.loads, 1);
  assert.deepEqual(detector.runtimeStatus(), {
    state: 'AVAILABLE',
    modelSource: BLAZEFACE_MODEL_SOURCE,
    modelVersion: BLAZEFACE_MODEL_VERSION,
    packageVersion: BLAZEFACE_PACKAGE_VERSION,
    loadStrategy: 'production_startup_preload',
    timeoutMs: 50,
    cache: 'process_memory',
  });
  await detector.onModuleDestroy();
}

async function testOfflineAndCorruptLoadFailStartupAndRequests(): Promise<void> {
  const detector = new ControlledDetector(
    config({ NODE_ENV: 'production' }),
    'failure',
  );
  await assert.rejects(() => detector.onModuleInit(), /simulated offline model/);
  assert.equal(detector.runtimeStatus().state, 'UNAVAILABLE');
  await assert.rejects(
    () => detector.detect(Buffer.from('not-used')),
    (error: unknown) =>
      error instanceof ServiceUnavailableException &&
      (error.getResponse() as { code?: string }).code ===
        'face_detector_unavailable',
  );
  assert.equal(detector.loads, 1);
}

async function testHangingLoadIsBounded(): Promise<void> {
  const detector = new ControlledDetector(
    config({
      NODE_ENV: 'production',
      BLAZEFACE_MODEL_LOAD_TIMEOUT_MS: '5',
    }),
    'hang',
  );
  const started = Date.now();
  await assert.rejects(() => detector.onModuleInit(), /timed out after 5ms/);
  assert.ok(Date.now() - started < 1_000);
  assert.equal(detector.runtimeStatus().state, 'UNAVAILABLE');
}

async function testNonProductionDoesNotFetchAtStartup(): Promise<void> {
  const detector = new ControlledDetector(
    config({ NODE_ENV: 'test' }),
    'failure',
  );
  await detector.onModuleInit();
  assert.equal(detector.loads, 0);
  assert.equal(detector.runtimeStatus().state, 'UNAVAILABLE');
}

async function main(): Promise<void> {
  await testProductionStartupPreloadAndMetadata();
  await testOfflineAndCorruptLoadFailStartupAndRequests();
  await testHangingLoadIsBounded();
  await testNonProductionDoesNotFetchAtStartup();
  console.log('phase3b-blazeface-runtime: PASS');
}

void main();
