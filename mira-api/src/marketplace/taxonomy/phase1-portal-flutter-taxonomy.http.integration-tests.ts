/**
 * Phase1 item2: real Nest + PartnersApi.taxonomy (api.js) + EleganceTaxonomySource + cache isolation.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FirebaseIdTokenVerifier } from '../../common/auth/firebase-id-token-verifier';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnersPortalController } from '../../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../../partners-portal/partners-portal.service';
import { PartnerTokenGuard } from '../../partners-portal/guards/partner-token.guard';
import { RegistryService } from '../../partners-portal/registry/registry.service';
import { EditorDraftsService } from '../../partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../../partners-portal/editor-drafts/service-profile.service';
import { BulkBatchesService } from '../../partners-portal/bulk-batches/bulk-batches.service';
import { VariantInventoryService } from '../../partners-portal/variant-inventory.service';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { CatalogContentService } from '../catalog-content.service';
import { CatalogMediaController } from '../catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../catalog-media.storage';
import { CatalogReviewAdminController } from '../catalog-review.admin.controller';
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceService } from '../marketplace.service';
import { TaxonomyService } from './taxonomy.service';

const probeId = 'jewelry.__phase1_portal_flutter__';
const expectedProfileId = 'product.jewelry';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController, MarketplaceController],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    RegistryService,
    EditorDraftsService,
    BulkBatchesService,
    ServiceProfileService,
    VariantInventoryService,
    TaxonomyService,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService, tax: TaxonomyService) => new MarketplaceService(prisma, tax),
      inject: [PrismaService, TaxonomyService],
    },
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'x' }) } },
  ],
})
class Phase1PortalFlutterModule {}

function runCmd(
  bin: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: opts.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ status: 124, stdout, stderr: stderr + '\nTIMEOUT' });
    }, opts.timeoutMs ?? 240000);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

function sortCopy(xs: string[]) {
  return [...xs].sort();
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const started = new Date().toISOString();
  const app = await NestFactory.create(Phase1PortalFlutterModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const apiBase = `http://127.0.0.1:${port}/api/v1`;
  const taxonomy = app.get(TaxonomyService);
  const registry = app.get(RegistryService);

  const injected = taxonomy.injectTestBranch({
    lane: 'jewelry',
    parentId: 'jewelry',
    id: probeId,
    labelAr: 'فرع بوابة/فلاتر',
    profileId: expectedProfileId,
  });

  const expectedProfile = registry.getProfile(expectedProfileId);
  assert.ok(expectedProfile);
  const expectedFieldIds = sortCopy([...(expectedProfile!.fields || [])]);
  assert.ok(expectedFieldIds.includes('metal'));
  const expectedFilterKeys = sortCopy([
    ...new Set(
      expectedFieldIds
        .map((fid) => registry.getRegistry().fields[fid]?.filter)
        .filter((f): f is string => typeof f === 'string' && !!f.trim()),
    ),
  ]);
  assert.ok(expectedFilterKeys.includes('metal'));
  assert.ok(expectedFilterKeys.includes('purity'));

  const repoRoot = path.resolve(__dirname, '../../../../');
  const portalScript = path.join(repoRoot, 'mira-api/scripts/phase1-portal-taxonomy-read.mjs');
  assert.ok(existsSync(portalScript), 'portal taxonomy reader missing');

  const portalRun = await runCmd(
    process.execPath,
    [portalScript, `--base=${apiBase}`, '--lane=jewelry', '--audience=partner'],
    { cwd: path.join(repoRoot, 'mira-api'), timeoutMs: 60000 },
  );
  if (portalRun.status !== 0) {
    console.error(portalRun.stdout);
    console.error(portalRun.stderr);
  }
  assert.equal(portalRun.status, 0, 'PartnersApi.taxonomy invocation failed');
  const portalDoc = JSON.parse(portalRun.stdout);
  const portalNode = (portalDoc.nodes || []).find((n: any) => n.id === probeId);
  assert.ok(portalNode, 'portal PartnersApi.taxonomy missing probe');
  assert.equal(portalNode.parentId, 'jewelry');
  assert.equal(portalNode.profileId, expectedProfileId);
  assert.equal(String(portalDoc.definitionsVersion), String(injected.definitionsVersion));
  assert.deepEqual(sortCopy(portalNode.fieldIds || []), expectedFieldIds);
  assert.deepEqual(sortCopy(portalNode.filterKeys || []), expectedFilterKeys);

  const flutterBin = process.env.FLUTTER_BIN || '/Users/fayez/flutter/bin/flutter';
  const flutterProbe = await runCmd(
    flutterBin,
    [
      'test',
      '--reporter',
      'expanded',
      `--dart-define=MIRA_API_BASE_URL=${apiBase}`,
      '--dart-define=USE_MIRA_API=true',
      `--dart-define=PHASE1_PROBE_ID=${probeId}`,
      '--dart-define=PHASE1_PROBE_PARENT=jewelry',
      `--dart-define=PHASE1_PROBE_VERSION=${injected.definitionsVersion}`,
      `--dart-define=PHASE1_PROBE_PROFILE=${expectedProfileId}`,
      `--dart-define=PHASE1_PROBE_FIELDS=${expectedFieldIds.join(',')}`,
      `--dart-define=PHASE1_PROBE_FILTERS=${expectedFilterKeys.join(',')}`,
      'test/features/marketplace/phase1_taxonomy_live_probe_test.dart',
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, PATH: `/Users/fayez/flutter/bin:${process.env.PATH || ''}` },
    },
  );
  if (flutterProbe.status !== 0) {
    console.error(flutterProbe.stdout);
    console.error(flutterProbe.stderr);
  }
  assert.equal(flutterProbe.status, 0, 'Flutter taxonomy source probe failed');
  const flutterMarker = flutterProbe.stdout.match(/PHASE1_FLUTTER_READ=(\{.*\})/);
  assert.ok(flutterMarker, 'missing PHASE1_FLUTTER_READ');
  const flutterPayload = JSON.parse(flutterMarker![1]);
  assert.equal(flutterPayload.id, probeId);
  assert.equal(flutterPayload.parentId, 'jewelry');
  assert.equal(flutterPayload.profileId, expectedProfileId);
  assert.equal(String(flutterPayload.definitionsVersion), String(injected.definitionsVersion));
  assert.deepEqual(sortCopy(flutterPayload.fieldIds || []), expectedFieldIds);
  assert.deepEqual(sortCopy(flutterPayload.filterKeys || []), expectedFilterKeys);

  const cacheIso = await runCmd(
    flutterBin,
    [
      'test',
      '--reporter',
      'expanded',
      `--dart-define=MIRA_API_BASE_URL=${apiBase}`,
      '--dart-define=USE_MIRA_API=true',
      `--dart-define=PHASE1_JEWELRY_MARKER=${probeId}`,
      '--dart-define=PHASE1_ELEGANCE_MARKER=clothes',
      'test/features/marketplace/phase1_taxonomy_cache_isolation_test.dart',
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, PATH: `/Users/fayez/flutter/bin:${process.env.PATH || ''}` },
    },
  );
  if (cacheIso.status !== 0) {
    console.error(cacheIso.stdout);
    console.error(cacheIso.stderr);
  }
  assert.equal(cacheIso.status, 0, 'Flutter cache isolation failed');

  const evidence = {
    id: 'P1-PORTAL-FLUTTER-TAXONOMY',
    ok: true,
    started,
    finished: new Date().toISOString(),
    apiBase,
    expected: {
      id: probeId,
      parentId: 'jewelry',
      profileId: expectedProfileId,
      definitionsVersion: injected.definitionsVersion,
      fieldIds: expectedFieldIds,
      filterKeys: expectedFilterKeys,
    },
    portal: {
      id: portalNode.id,
      parentId: portalNode.parentId,
      profileId: portalNode.profileId,
      definitionsVersion: portalDoc.definitionsVersion,
      fieldIds: sortCopy(portalNode.fieldIds || []),
      filterKeys: sortCopy(portalNode.filterKeys || []),
    },
    flutter: flutterPayload,
    cacheIsolation: { status: cacheIso.status },
  };
  console.log(JSON.stringify(evidence, null, 2));
  console.log('PASS P1-PORTAL-FLUTTER-TAXONOMY');
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
