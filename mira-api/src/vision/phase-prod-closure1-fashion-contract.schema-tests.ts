import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { AiGatewayController } from '../ai/ai-gateway.controller';
import { VisionOutfitAnalyzeBodyDto } from './dto/vision-outfit-analyze-body.dto';

async function run() {
  const dto = Object.assign(new VisionOutfitAnalyzeBodyDto(), {
    occasionId: 'work',
    mode: 'smart' as const,
    skinSnapshot: JSON.stringify({ undertone: 'warm' }),
    locale: 'ar',
  });
  assert.deepEqual(await validate(dto), []);

  const garment = {
    garmentId: 'garm_contract_1',
    version: 'garment-schema-v1',
    identity: {
      categoryId: 'outerwear',
      typeId: 'blazer',
      entityClass: 'garment',
    },
    attributes: {
      colors: ['beige_linen'],
      material: { kind: 'estimated', value: 'linen' },
      season: ['all_season'],
      occasion: ['work'],
      styleHints: ['business'],
    },
    geometryRef: { segmentId: 'segment-1', regionRole: 'outerwear' },
    confidence: 0.82,
    fieldConfidence: [],
    availability: 'detected',
    source: 'vision',
    limitations: [],
    explainability: [],
    runtime: {},
    mappingVersion: 'garment-mapping-v1',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
  const calls: unknown[] = [];
  const orchestrator = {
    analyze: async (input: unknown) => {
      calls.push(input);
      return {
        garments: [garment],
        analysis: null,
        warnings: [],
        limitations: [],
        runtime: { version: 'fashion-runtime-v1' },
        processingMs: 10,
        analysisGate: 'proceed',
        userMessageAr: undefined,
        meta: { traceId: 'trace-1', confidence: 82 },
      };
    },
  };

  const controller = new AiGatewayController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    orchestrator as never,
    {} as never,
    {} as never,
  );
  const response = await controller.analyzeVisionOutfit(
    { buffer: Buffer.from('image') } as Express.Multer.File,
    dto,
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    imageBytes: Buffer.from('image'),
    occasionId: 'work',
    mode: 'smart',
    skinSnapshot: { undertone: 'warm' },
    locale: 'ar',
  });
  assert.deepEqual(response.garments, [garment]);
  assert.equal(response.meta.analysisGate, 'proceed');
  assert.equal(response.meta.confidence, 82);
  assert.equal('fashionVision' in response, false);

  const invalid = Object.assign(new VisionOutfitAnalyzeBodyDto(), {
    occasionId: '',
    mode: 'unknown',
  });
  assert.ok((await validate(invalid)).length >= 2);

  console.log('phase_prod_closure1_fashion_contract: PASS');
}

void run();
