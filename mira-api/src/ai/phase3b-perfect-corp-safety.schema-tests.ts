import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import {
  PerfectCorpService,
  REQUIRED_YOUCAM_CONCERNS,
  YouCamConcern,
} from './services/perfect-corp.service';

const completeConcerns = (): YouCamConcern[] =>
  REQUIRED_YOUCAM_CONCERNS.map((type, index) => ({
    type,
    ui_score: 61 + index,
  }));

function config(overrides: Record<string, unknown> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (key in overrides ? overrides[key] : fallback) as T,
  } as ConfigService;
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function rejectsMessage(
  action: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await assert.rejects(action, pattern);
}

function testCompleteResponsePreservesProviderValues(): void {
  const service = new PerfectCorpService(config());
  const concerns = completeConcerns();
  const result = service.mapYouCamResults(concerns);

  for (const concern of concerns) {
    assert.equal(result.concernScores?.[concern.type], concern.ui_score);
  }
  assert.equal(result.hydration, concerns.find((x) => x.type === 'moisture')!.ui_score);
  assert.equal(result.oiliness, concerns.find((x) => x.type === 'oiliness')!.ui_score);
}

function testIncompleteResponsesFailClosed(): void {
  const service = new PerfectCorpService(config());
  const complete = completeConcerns();

  assert.throws(
    () => service.mapYouCamResults(complete.filter((x) => x.type !== 'pore')),
    /missing or invalid ui_score for pore/,
  );
  assert.throws(
    () =>
      service.mapYouCamResults(
        complete.filter((x) => x.type !== 'pore' && x.type !== 'texture'),
      ),
    /pore,texture/,
  );
  assert.throws(
    () =>
      service.mapYouCamResults(
        complete.map((x) =>
          x.type === 'acne'
            ? ({ ...x, ui_score: undefined } as YouCamConcern)
            : x,
        ),
      ),
    /ui_score for acne/,
  );
  assert.throws(
    () =>
      service.mapYouCamResults(
        complete.map((x) =>
          x.type === 'redness'
            ? ({ ...x, ui_score: '85' } as unknown as YouCamConcern)
            : x,
        ),
      ),
    /ui_score for redness/,
  );
  assert.throws(
    () =>
      service.mapYouCamResults(
        complete.map((x) =>
          x.type === 'wrinkle' ? { ...x, ui_score: 101 } : x,
        ),
      ),
    /ui_score for wrinkle/,
  );
  assert.throws(
    () => service.mapYouCamResults([]),
    /missing or invalid ui_score/,
  );
}

async function testProviderHttpAndMalformedFailures(): Promise<void> {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [400, 401, 403, 429, 500, 503]) {
      globalThis.fetch = async () => response(status, { error: 'redacted' });
      await rejectsMessage(
        () => new PerfectCorpService(config({ PERFECT_API_KEY: 'test-only' })).analyzeSkin(Buffer.from([0xff, 0xd8])),
        new RegExp(`File API ${status}`),
      );
    }

    globalThis.fetch = async () => response(200, { data: { files: [] } });
    await rejectsMessage(
      () => new PerfectCorpService(config({ PERFECT_API_KEY: 'test-only' })).analyzeSkin(Buffer.from([0xff, 0xd8])),
      /missing file_id or upload URL/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testProviderPollTimeout(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let call = 0;
  try {
    globalThis.fetch = async () => {
      call += 1;
      if (call === 1) {
        return response(200, {
          data: {
            files: [
              {
                file_id: 'file-test',
                requests: [{ method: 'PUT', url: 'https://upload.invalid' }],
              },
            ],
          },
        });
      }
      if (call === 2) return response(200, {});
      if (call === 3) return response(200, { data: { task_id: 'task-test' } });
      return response(200, { data: { task_status: 'running' } });
    };

    await rejectsMessage(
      () =>
        new PerfectCorpService(
          config({
            PERFECT_API_KEY: 'test-only',
            PERFECT_CORP_POLL_INTERVAL_MS: 0,
            PERFECT_CORP_POLL_MAX_MS: 1,
          }),
        ).analyzeSkin(Buffer.from([0xff, 0xd8])),
      /timed out/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  testCompleteResponsePreservesProviderValues();
  testIncompleteResponsesFailClosed();
  await testProviderHttpAndMalformedFailures();
  await testProviderPollTimeout();
  console.log('phase3b-perfect-corp-safety: PASS (14 adversarial classes)');
}

void main();
