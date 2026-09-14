/**
 * PROD-CLOSURE Phase 1 Face C — activation boundary regression tests.
 *
 * Run:
 * npx ts-node --transpile-only \
 *   src/production-entitlements/phase-prod-closure1-face-activation.schema-tests.ts
 *
 * The runtime master controls only the new 9C/9D/9F experience. These tests
 * deliberately do not execute or modify the frozen Skin/Face engines.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProductionEntitlementService } from './production-entitlement.service';
import { ProductionEntitlementController } from './production-entitlement.controller';
import { SkinAnalysisController } from '../skin-analysis/skin-analysis.controller';
import {
  buildStoredPayload,
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
  SkinAnalysisResponseDto,
} from '../skin-analysis/dto/skin-analysis-response.dto';

function envMap(map: Record<string, string | undefined>) {
  return (key: string, fallback?: string) => map[key] ?? fallback;
}

function source(relativePath: string): string {
  const adjacent = join(__dirname, '..', relativePath);
  const sourcePath = existsSync(adjacent)
    ? adjacent
    : join(process.cwd(), 'src', relativePath);
  return readFileSync(sourcePath, 'utf8');
}

async function run() {
  const entitlements = new ProductionEntitlementService();

  // Experience truth table: missing/OFF/ON master and allowlist authority.
  for (const row of [
    { master: undefined, allowlist: 'uid-owner', expectedExperience: false },
    { master: 'false', allowlist: 'uid-owner', expectedExperience: false },
    { master: 'true', allowlist: undefined, expectedExperience: false },
    { master: 'true', allowlist: 'uid-other', expectedExperience: false },
    { master: 'true', allowlist: 'uid-owner', expectedExperience: true },
  ] as const) {
    const snapshot = entitlements.resolveForFirebaseUid(
      'uid-owner',
      envMap({
        MIRA_FACE_EXPERIENCE_MASTER_ENABLED: row.master,
        MIRA_PRODUCTION_INTERNAL_UIDS: row.allowlist,
      }),
    );
    assert.equal(snapshot.faceExperienceV1, row.expectedExperience);
  }

  // Runtime endpoint projects the experience decision only.
  for (const enabled of [false, true]) {
    const controller = new ProductionEntitlementController({
      resolveForFirebaseUid: () => ({
        faceExperienceV1: enabled,
        fashionAdvisorModeB: false,
        version: 'face-c-test',
      }),
    } as unknown as ProductionEntitlementService);
    assert.deepEqual(controller.runtime({ firebaseUid: 'uid-owner' } as never), {
      faceExperienceV1: enabled,
      fashionAdvisorModeB: false,
      version: 'face-c-test',
    });
  }

  // Both legacy Skin entry routes continue delegating to processing regardless
  // of experience state; neither controller consumes the runtime entitlement.
  const analyzeCalls: unknown[][] = [];
  const skinService = {
    analyze: (...args: unknown[]) => {
      analyzeCalls.push(args);
      return Promise.resolve({ route: 'legacy-skin' });
    },
  };
  const legacyController = new SkinAnalysisController(skinService as never);
  const user = { firebaseUid: 'uid-owner' } as never;
  const image = { buffer: Buffer.from('image') } as Express.Multer.File;
  await legacyController.analyze(user, image, { faceIntel: '{"version":1}' });
  assert.equal(analyzeCalls.length, 1);
  assert.equal(analyzeCalls[0]?.[2], '{"version":1}');

  // Persistence/result compatibility remains independent of experience state:
  // V2 stores the report; legacy records and the deprecated result sibling are
  // still routable by their existing helpers.
  const report = { version: 'test-report' } as never;
  const stored = buildStoredPayload(report);
  assert.equal(extractMiraReportFromStored(stored), report);

  const legacySkin = { beautyScore: 71, concerns: [] } as never;
  assert.equal(extractLegacySkinFromStored(legacySkin), legacySkin);
  const response = SkinAnalysisResponseDto.from(
    'analysis-1',
    new Date('2026-08-30T00:00:00.000Z'),
    report,
    legacySkin,
  );
  assert.equal(response.miraReport, report);
  assert.equal(response.skin, legacySkin);

  // Static boundary guards cover wiring that is expensive to execute in this
  // schema harness. They fail if experience entitlement is introduced into
  // processing, persistence, legacy result routing, or stored advisor context.
  const processingSource = source('skin-analysis/skin-analysis.service.ts');
  assert.match(processingSource, /parseFaceIntelPackage\(faceIntelRaw\)/);
  assert.match(processingSource, /prisma\.skinAnalysis\.create\(/);
  assert.match(processingSource, /prisma\.skinAnalysis\.update\(/);
  assert.doesNotMatch(
    processingSource,
    /MIRA_FACE_EXPERIENCE_MASTER_ENABLED|faceExperienceV1|ProductionEntitlementService/,
  );

  const gatewaySource = source('ai/ai-gateway.controller.ts');
  assert.match(gatewaySource, /@Post\('skin-analysis'\)/);
  assert.match(gatewaySource, /this\.skinAnalysisService\.analyze\(/);
  assert.doesNotMatch(
    gatewaySource,
    /MIRA_FACE_EXPERIENCE_MASTER_ENABLED|faceExperienceV1|ProductionEntitlementService/,
  );

  const resultRoutingSource = source(
    'skin-analysis/dto/skin-analysis-response.dto.ts',
  );
  assert.match(resultRoutingSource, /skin\?: SkinAnalysisResult/);
  assert.match(resultRoutingSource, /extractLegacySkinFromStored/);
  assert.doesNotMatch(
    resultRoutingSource,
    /MIRA_FACE_EXPERIENCE_MASTER_ENABLED|faceExperienceV1/,
  );

  const advisorSource = source('advisor/advisor.service.ts');
  assert.match(advisorSource, /loadFaceEvidence\(/);
  assert.match(advisorSource, /extractMiraReportFromStored\(row\.resultJson\)/);
  assert.doesNotMatch(
    advisorSource,
    /entitlement\.faceExperienceV1|MIRA_FACE_EXPERIENCE_MASTER_ENABLED/,
  );

  console.log('phase_prod_closure1_face_activation: PASS');
}

void run();
