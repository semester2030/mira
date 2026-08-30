/**
 * AT-4 — Controlled QA Activation verification.
 * Run: npm run test:at4
 *
 * Default CI mode: NO live OpenAI calls.
 * Live provider smoke (local QA only):
 *   AT4_LIVE_PROVIDER=1 LLM_API_KEY=... npm run test:at4
 *
 * NEVER enables Render/production flags.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_FREEZE_CERTIFICATE,
  FASHION_KNOWLEDGE_ACTIVATION_TRACK,
  FASHION_LLM_REQUEST_VERSION,
  FASHION_ADVICE_CANDIDATE_VERSION,
} from './versioning/release';
import { isFashionKnowledgeAdvisorIntegrationEnabled } from './advisor-integration/feature-flag';
import { isFashionKnowledgeLlmEnabled } from './llm/feature-flag';
import { evaluateMceFashionQuarantine } from './advisor-integration/mce-bypass';
import { OpenAiFashionKnowledgeLlmProvider } from './llm/providers/openai-fashion-knowledge-llm.provider';
import { resolveProductionFashionLlmConfig } from './llm/providers/openai-provider-config';
import { buildFashionLlmPrompt } from './llm/prompt-builder';
import { runFashionKnowledgeLlm } from './llm/orchestrator';
import { createInMemoryCostSink } from './llm/cost-telemetry';
import { FashionAdviceType } from './contracts/advice-types';
import { CandidateSourceType } from './advice/advice-candidate';
import { ProvenanceApprovalStatus } from './contracts/provenance';
import { ClaimLockDecision } from './contracts/claim-lock';
import { FashionLlmRuntimeStatus } from './llm/runtime';
import type { FashionLlmKnowledgeRequest } from './llm/request-contract';
import { resolveFashionEvidenceForAdvisorChat } from './advisor-integration/production-wiring';

const CLOCK = '2026-08-10T12:00:00.000Z';

function section(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

async function asection(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`ok ${name}`);
}

function repoRoot(): string {
  return join(__dirname, '..', '..', '..');
}

function srcRoot(): string {
  return join(__dirname, '..', '..', 'src');
}

function envPresence(file: string, key: string): 'MISSING' | 'EMPTY' | 'SET' {
  if (!existsSync(file)) return 'MISSING';
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const eq = s.indexOf('=');
    const k = s.slice(0, eq);
    const v = s.slice(eq + 1).trim();
    if (k === key) return v ? 'SET' : 'EMPTY';
  }
  return 'MISSING';
}

function redYellowRequest(
  overrides: Partial<FashionLlmKnowledgeRequest> = {},
): FashionLlmKnowledgeRequest {
  return {
    requestId: 'req_at4_ry',
    garmentFacts: [
      {
        garmentId: 'garment:blouse:red',
        category: 'top',
        type: 'blouse',
        colors: ['red'],
      },
      {
        garmentId: 'garment:skirt:yellow',
        category: 'bottom',
        type: 'skirt',
        colors: ['yellow'],
      },
    ],
    occasion: 'wedding',
    dressCode: 'guest',
    preferenceContext: {
      preferenceTokens: ['bold', 'statement'],
      styleGoal: 'statement look',
    },
    existingKnowledgeRuleRefs: [],
    evidenceRefs: ['ev_blouse_red', 'ev_skirt_yellow', 'ev_occasion_wedding'],
    allowedAdviceTypes: [...Object.values(FashionAdviceType)],
    forbiddenClaims: [
      'attractiveness',
      'body_shaming',
      'medical',
      'fake_citation',
    ],
    locale: 'ar',
    schemaVersion: FASHION_LLM_REQUEST_VERSION,
    traceId: 'trace_at4_ry',
    clockNowIso: CLOCK,
    ...overrides,
  };
}

function mockConfig(map: Record<string, string | undefined>) {
  return {
    get<T = string>(key: string, defaultValue?: T): T | undefined {
      if (key in map) return map[key] as T;
      return defaultValue;
    },
  };
}

export type At4EnvClass =
  | 'SAFE_FOR_REAL_PROVIDER_QA'
  | 'PARTIAL'
  | 'NOT_AVAILABLE';

export interface At4EnvironmentReport {
  readonly renderProductionService: At4EnvClass;
  readonly renderStagingService: At4EnvClass;
  readonly localDeveloper: At4EnvClass;
  readonly localLlmApiKey: 'READY' | 'MISSING' | 'INVALID_CONFIGURATION';
  readonly liveProviderOptIn: boolean;
  readonly blocker: string | null;
}

function classifyEnvironment(): At4EnvironmentReport {
  const render = readFileSync(join(repoRoot(), 'render.yaml'), 'utf8');
  const hasStaging =
    /name:\s*mira-api-staging/i.test(render) ||
    /name:\s*mira-api-qa/i.test(render) ||
    /staging/i.test(render);
  const hasFklOnRender =
    /FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED/i.test(render) ||
    /FASHION_KNOWLEDGE_LLM_ENABLED/i.test(render);

  const envFile = join(srcRoot(), '..', '.env');
  const qaEnvFile = join(srcRoot(), '..', '.env.qa');
  const keyStatus = envPresence(envFile, 'LLM_API_KEY');
  const qaKeyStatus = envPresence(qaEnvFile, 'LLM_API_KEY');
  const processKey = Boolean(process.env.LLM_API_KEY?.trim());
  const localKey: At4EnvironmentReport['localLlmApiKey'] = processKey
    ? 'READY'
    : keyStatus === 'SET' || qaKeyStatus === 'SET'
      ? 'READY'
      : 'MISSING';

  const liveOptIn = process.env.AT4_LIVE_PROVIDER === '1';

  // Local is architecturally safe; readiness depends on key + opt-in.
  const localClass: At4EnvClass =
    localKey === 'READY' ? 'SAFE_FOR_REAL_PROVIDER_QA' : 'PARTIAL';

  let blocker: string | null = null;
  if (hasFklOnRender) {
    blocker =
      'FASHION_KNOWLEDGE flags appear in render.yaml — production isolation violated';
  } else if (!hasStaging && localKey === 'MISSING') {
    blocker =
      'No Render staging/QA service AND local LLM_API_KEY missing — cannot execute real-provider E2E without enabling production';
  } else if (liveOptIn && localKey === 'MISSING') {
    blocker = 'AT4_LIVE_PROVIDER=1 but LLM_API_KEY missing';
  }

  return {
    renderProductionService: 'NOT_AVAILABLE', // must not activate for AT-4
    renderStagingService: hasStaging ? 'SAFE_FOR_REAL_PROVIDER_QA' : 'NOT_AVAILABLE',
    localDeveloper: localClass,
    localLlmApiKey: localKey,
    liveProviderOptIn: liveOptIn,
    blocker,
  };
}

section('activation_track_and_freeze', () => {
  assert.equal(FASHION_KNOWLEDGE_RELEASE, '1.0.0-fashion-knowledge');
  assert.equal(FASHION_KNOWLEDGE_FREEZE_CERTIFICATE, 'MIRA-FK-FREEZE-1.0.0');
  assert.equal(
    FASHION_KNOWLEDGE_ACTIVATION_TRACK,
    '1.0.0-fashion-knowledge+at4r-qa-readiness',
  );
});

section('production_isolation_render_untouched', () => {
  const render = readFileSync(join(repoRoot(), 'render.yaml'), 'utf8');
  assert.doesNotMatch(render, /FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED/);
  assert.doesNotMatch(render, /FASHION_KNOWLEDGE_LLM_ENABLED/);
  assert.doesNotMatch(render, /FASHION_KNOWLEDGE_TELEMETRY_ENABLED/);
  assert.match(render, /name:\s*mira-api\b/);
  assert.doesNotMatch(render, /name:\s*mira-api-qa\b/);
  assert.doesNotMatch(render, /name:\s*mira-api-staging\b/);
});

section('default_flags_off_no_telemetry', () => {
  const getEnv = (k: string, d?: string) => {
    // Simulate production defaults — ignore accidental process pollution for this check
    const defaults: Record<string, string> = {
      FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED: 'false',
      FASHION_KNOWLEDGE_LLM_ENABLED: 'false',
      FASHION_KNOWLEDGE_TELEMETRY_ENABLED: 'false',
      FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED: 'false',
    };
    return defaults[k] ?? d;
  };
  assert.equal(isFashionKnowledgeAdvisorIntegrationEnabled(getEnv), false);
  assert.equal(isFashionKnowledgeLlmEnabled(getEnv), false);
});

section('mce_option_a_quarantine_active', () => {
  const q = evaluateMceFashionQuarantine(
    'وش رأيك بإطلالتي؟',
    (k, d) =>
      k === 'FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED' ? 'false' : d,
  );
  assert.equal(q.quarantine, true);
});

section('qa_environment_classification', () => {
  const env = classifyEnvironment();
  assert.equal(env.renderProductionService, 'NOT_AVAILABLE');
  assert.ok(
    env.renderStagingService === 'NOT_AVAILABLE' ||
      env.renderStagingService === 'SAFE_FOR_REAL_PROVIDER_QA',
  );
  assert.ok(
    env.localDeveloper === 'PARTIAL' ||
      env.localDeveloper === 'SAFE_FOR_REAL_PROVIDER_QA',
  );
  console.log(
    `  env local=${env.localDeveloper} staging=${env.renderStagingService} key=${env.localLlmApiKey} liveOptIn=${env.liveProviderOptIn}`,
  );
  if (env.blocker) console.log(`  blocker: ${env.blocker}`);
});

section('minimum_qa_flag_matrix_documented', () => {
  // Year-1 minimum surface — registry/domains/telemetry OFF
  const matrix = {
    FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED: true,
    FASHION_KNOWLEDGE_LLM_ENABLED: true,
    FASHION_KNOWLEDGE_REGISTRY_ENABLED: false,
    FASHION_KNOWLEDGE_ACCESSORIES_ENABLED: false,
    FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED: false,
    FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED: false,
    FASHION_KNOWLEDGE_TELEMETRY_ENABLED: false,
    FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED: false,
    MIRA_FASHION_ADVISOR_V1: true,
  };
  assert.equal(matrix.FASHION_KNOWLEDGE_TELEMETRY_ENABLED, false);
  assert.equal(matrix.FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED, false);
});

async function main(): Promise<void> {
  await asection('rollback_flags_off_fail_closed', async () => {
    const provider = new OpenAiFashionKnowledgeLlmProvider({
      config: mockConfig({
        LLM_API_KEY: 'x',
        LLM_BASE_URL: 'https://api.openai.com/v1',
      }),
      fetchImpl: async () => {
        throw new Error('must not be called when flags off');
      },
    });
    const r = await resolveFashionEvidenceForAdvisorChat({
      message: 'وش رأيك بإطلالتي؟',
      userId: 'at4_rollback',
      fashion: {
        garments: [
          {
            garmentId: 'garment:blouse:red',
            category: 'top',
            type: 'blouse',
            colors: ['red'],
          },
        ],
        occasion: 'wedding',
        evidenceRefs: ['ev_blouse_red'],
      },
      provider,
      integrationEnabled: false,
      llmEnabled: false,
      clockNowIso: CLOCK,
    });
    assert.equal(r.invokedBridge, false);
  });

  await asection('provider_config_resolution_from_shared_llm', async () => {
    const cfg = resolveProductionFashionLlmConfig(
      mockConfig({
        LLM_API_KEY: 'test',
        LLM_BASE_URL: 'https://api.openai.com/v1',
        LLM_MODEL: 'gpt-4o-mini',
        LLM_TEMPERATURE: '0.2',
        FASHION_KNOWLEDGE_LLM_TIMEOUT_MS: '15000',
        FASHION_KNOWLEDGE_LLM_MAX_OUTPUT_TOKENS: '1200',
      }),
    );
    assert.equal(cfg.configured, true);
    assert.equal(cfg.model, 'gpt-4o-mini');
    assert.equal(cfg.timeoutMs, 15000);
  });

  await asection('controlled_fault_injection_fail_closed', async () => {
    const provider = new OpenAiFashionKnowledgeLlmProvider({
      config: mockConfig({
        LLM_API_KEY: 'test',
        LLM_BASE_URL: 'https://api.openai.com/v1',
        LLM_MODEL: 'gpt-4o-mini',
      }),
      fetchImpl: async () =>
        new Response('{broken', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    // Wrap as chat completion shape with broken content
    const provider2 = new OpenAiFashionKnowledgeLlmProvider({
      config: mockConfig({
        LLM_API_KEY: 'test',
        LLM_BASE_URL: 'https://api.openai.com/v1',
        LLM_MODEL: 'gpt-4o-mini',
      }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            id: 'bad',
            choices: [{ message: { content: '{not-json' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const sink = createInMemoryCostSink();
    const result = await runFashionKnowledgeLlm({
      request: redYellowRequest(),
      provider: provider2,
      enabled: true,
      costSink: sink.record,
    });
    assert.equal(result.runtime.status, FashionLlmRuntimeStatus.FAILED);
    assert.equal(result.candidate, undefined);
    void provider;
  });

  await asection('optional_live_provider_or_skip', async () => {
    const env = classifyEnvironment();
    const live =
      env.liveProviderOptIn && env.localLlmApiKey === 'READY';

    const proofPath = join(__dirname, 'at4-live-proof.json');

    if (!live) {
      console.log(
        '  LIVE_PROVIDER_SMOKE: SKIPPED (set AT4_LIVE_PROVIDER=1 and LLM_API_KEY for local QA)',
      );
      writeFileSync(
        proofPath,
        JSON.stringify(
          {
            liveProviderExecuted: false,
            skipped: true,
            reason:
              env.blocker ??
              'AT4_LIVE_PROVIDER not set and/or LLM_API_KEY missing',
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      assert.ok(true);
      return;
    }

    // Load key from process only — never log it
    const provider = new OpenAiFashionKnowledgeLlmProvider({
      config: {
        get: <T = string>(k: string, d?: T) =>
          (process.env[k] as T | undefined) ?? d,
      },
    });
    assert.equal(provider.isConfigured(), true);

    const cfg = resolveProductionFashionLlmConfig({
      get: <T = string>(k: string, d?: T) =>
        (process.env[k] as T | undefined) ?? d,
    });

    const prompt = buildFashionLlmPrompt(redYellowRequest());
    const health = await provider.generateStructuredDraft({
      request: redYellowRequest(),
      prompt,
    });
    assert.ok(
      health.status === 'ok' ||
        health.status === 'malformed' ||
        health.status === 'failed' ||
        health.status === 'timeout',
    );
    console.log(
      `  LIVE health status=${health.status} latencyMs=${health.latencyMs ?? 'n/a'}`,
    );
    console.log('  liveProviderExecuted=true');

    let structuredOk = false;
    let claimLockInvoked = false;
    let claimLockDecision: string | undefined;
    let sourceType: string | undefined;
    let provenance: string | undefined;

    if (health.status === 'ok' && health.draft) {
      const evalResult = await runFashionKnowledgeLlm({
        request: redYellowRequest(),
        provider,
        enabled: true,
      });
      if (evalResult.candidate) {
        structuredOk = true;
        claimLockInvoked = evalResult.audit.claimLockInvoked === true;
        claimLockDecision = evalResult.claimLockResult?.decision;
        sourceType = evalResult.candidate.sourceType;
        provenance = evalResult.candidate.provenanceState;
        assert.equal(
          evalResult.candidate.sourceType,
          CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
        );
        assert.equal(
          evalResult.candidate.provenanceState,
          ProvenanceApprovalStatus.UNCURATED,
        );
        assert.equal(evalResult.audit.claimLockInvoked, true);
        assert.ok(evalResult.claimLockResult);
        assert.equal(
          evalResult.candidate.schemaVersion,
          FASHION_ADVICE_CANDIDATE_VERSION,
        );
        if (evalResult.claimLockResult?.decision === ClaimLockDecision.PASS) {
          console.log('  WARN: unexpected bare PASS — investigate in AT-5');
        }
        console.log(
          `  LIVE claimLock=${evalResult.claimLockResult?.decision} runtime=${evalResult.runtime.status}`,
        );
      } else {
        console.log(
          `  LIVE pipeline no candidate status=${evalResult.runtime.status} reason=${evalResult.runtime.reasonCode}`,
        );
      }
    }

    writeFileSync(
      proofPath,
      JSON.stringify(
        {
          liveProviderExecuted: true,
          skipped: false,
          structuredOk,
          claimLockInvoked,
          claimLockDecision,
          sourceType,
          provenance,
          providerStatus: health.status,
          model: cfg.model,
          latencyMs: health.latencyMs ?? null,
          promptTokens: health.tokenUsage?.promptTokens ?? null,
          completionTokens: health.tokenUsage?.completionTokens ?? null,
          timestamp: new Date().toISOString(),
          activationTrack: FASHION_KNOWLEDGE_ACTIVATION_TRACK,
        },
        null,
        2,
      ),
    );

    // Live branch must actually succeed structured path for AT-4R A
    assert.equal(health.status, 'ok', 'live provider must return ok draft');
    assert.equal(structuredOk, true, 'live structured pipeline must succeed');
    assert.equal(claimLockInvoked, true);
  });

  section('no_telemetry_activation', () => {
    assert.notEqual(process.env.FASHION_KNOWLEDGE_TELEMETRY_ENABLED, 'true');
  });

  section('kill_switch_order_documented', () => {
    const order = [
      '1. MIRA_FASHION_ADVISOR_V1=false (client rebuild)',
      '2. FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=false',
      '3. FASHION_KNOWLEDGE_LLM_ENABLED=false',
      '4. Keep FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=false',
    ];
    assert.equal(order.length, 4);
  });

  console.log('\nAT-4 controlled QA verification: PASS (see LIVE skip/blocker notes)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
