/**
 * RC2 audit proofs against the real pipeline classes.
 * External providers are stubs. A passing check reproduces the behavior; it does not fix it.
 * Run: npx tsx src/vision/ai-audit-rc2.schema-tests.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { PerfectCorpService } from '../ai/services/perfect-corp.service';
import { parsePerfectHdMaskPayload } from '../ai/services/perfect-hd-mask.parser';
import { buildAgeComparison } from '../intelligence/pipeline/age-intelligence';
import { applyChildSafetyGuard } from '../intelligence/pipeline/child-safety-guard';
import { ConfidenceEngineService } from './pipeline/confidence-engine.service';
import { ConflictResolverService } from './pipeline/conflict-resolver.service';
import { FashionNormalizerService } from './pipeline/fashion-normalizer.service';
import { FashionValidatorService } from './pipeline/fashion-validator.service';
import { QualityGateService } from './pipeline/quality-gate.service';
import { TopologyResolverService } from './pipeline/topology-resolver.service';
import { buildPendingSemanticsPlaceholder } from './schema/fashion-vision-document.builder';
import { SemanticsPayload } from './schema/fashion-vision-document.v1';
import { VisionOrchestratorService } from './vision-orchestrator.service';

const checks: Array<Record<string, unknown>> = [];

function check(id: string, pass: boolean, actual: unknown) {
  checks.push({ id, pass, actual });
  assert.equal(pass, true, `${id}: ${JSON.stringify(actual)}`);
}

const required = ['wrinkle', 'pore', 'texture', 'acne', 'moisture', 'oiliness', 'redness', 'age_spot'];
const raw = {
  skin_age: 51,
  results: {
    output: required.map((type) => ({ type, ui_score: 100, raw_score: 100 })),
  },
};

const service = new PerfectCorpService({ get: () => undefined } as never);
const mapped = service.mapFromRawYouCam(raw).result;
const parsed = parsePerfectHdMaskPayload(raw);
check('provider-skin-age-parsed', parsed.skinAge === 51, parsed.skinAge);
check('displayed-skin-age-is-formula', mapped.skinAge === 28, mapped.skinAge);
check('formula-discards-provider-field', mapped.skinAge !== parsed.skinAge, {
  formula: mapped.skinAge,
  parsed: parsed.skinAge,
});

const safety = applyChildSafetyGuard({ birthYear: 1990, skinAge: mapped.skinAge });
const comparison = buildAgeComparison({
  birthYear: 1990,
  skinAge: mapped.skinAge,
  safety,
  concernIds: [],
});
check(
  'screen-headline-uses-formula-age',
  comparison.headlineAr.includes('بشرتك تبدو 28'),
  comparison.headlineAr,
);

const placeholder = buildPendingSemanticsPlaceholder();
check('placeholder-exists-internally', placeholder.garments[0]?.typeId === 'blazer', placeholder.garments[0]);

const shirt: SemanticsPayload = {
  garments: [
    {
      categoryId: 'outerwear',
      typeId: 'jacket',
      colors: ['black_pure'],
      providerConfidence: 0.8,
    },
  ],
  accessories: [],
  styleArchetypeId: 'business',
  layering: ['outerwear'],
  dominantColorIds: ['black_pure'],
  secondaryColorIds: [],
};

class RecordingSemantic {
  seen: unknown = null;
  payload: SemanticsPayload;
  constructor(payload: SemanticsPayload) {
    this.payload = payload;
  }
  async describe(input: { geometry?: unknown }) {
    this.seen = input.geometry;
    return this.payload;
  }
}

function orchestrator(semantic: RecordingSemantic) {
  return new VisionOrchestratorService(
    { segment: async () => { throw new ServiceUnavailableException({ code: 'FASHN_QUOTA_EXCEEDED', message: 'quota' }); } } as never,
    semantic as never,
    new FashionNormalizerService(),
    new FashionValidatorService(),
    new ConflictResolverService(),
    new TopologyResolverService(),
    new ConfidenceEngineService(),
    new QualityGateService(),
  );
}

async function main() {
const semantic = new RecordingSemantic(shirt);
const response = await orchestrator(semantic).analyze({
  imageBuffer: Buffer.from([1, 2, 3, 4]),
  occasionId: 'casual',
  mode: 'quick',
});
const geometry = semantic.seen as { segments?: Array<{ id?: string; regionRole?: string }> };
check('fashn-failure-sends-rectangle', geometry?.segments?.[0]?.id === 'degraded-full-body', geometry?.segments?.[0]);
check('result-garment-is-model-jacket', response.fashionVision.semantics.garments[0]?.typeId === 'jacket', response.fashionVision.semantics.garments);
check('placeholder-blazer-not-in-result', !JSON.stringify(response.fashionVision.semantics).includes('blazer'), response.fashionVision.semantics.garments);
check('degraded-gate', response.meta.analysisGate === 'degraded', response.meta.analysisGate);
check(
  'user-warning-names-missing-service',
  response.meta.userMessageAr === 'تحليل تقريبي — خدمة تحديد القطع غير متاحة مؤقتًا. أعيدي المحاولة لاحقًا لدقة أعلى.',
  response.meta.userMessageAr,
);

const empty = new RecordingSemantic({ ...shirt, garments: [] });
let emptyActual = 'returned';
try {
  await orchestrator(empty).analyze({
    imageBuffer: Buffer.from([1, 2, 3, 4]),
    occasionId: 'casual',
    mode: 'quick',
  });
} catch (error) {
  emptyActual = error instanceof Error ? error.message : String(error);
}
check('empty-garments-do-not-return-blazer', emptyActual.includes('quality gate') || emptyActual.includes('garment'), emptyActual);

const out = {
  round: 'RC2',
  ranAt: new Date().toISOString(),
  paidCalls: 0,
  note: 'PASS means the behavior was reproduced, not repaired.',
  checks,
};
writeFileSync(
  new URL(`file://${join(process.cwd(), '../tmp-risk-rc5/audit/results/ai-system-audit-rc2.json')}`),
  JSON.stringify(out, null, 2),
);
console.log('AI_SYSTEM_AUDIT_RC2_PASS');
}

main();
