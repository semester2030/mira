/**
 * Phase1 four-lanes acceptance — local only.
 * Critical: inject experimental branch in central taxonomy; portal + Flutter read paths
 * must observe the same id/parent/fields/definitionsVersion without client code edits.
 *
 * HTTP surface mirrors MarketplaceController taxonomy routes (same paths + query params).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { TaxonomyService } from './taxonomy.service';
import {
  composeDescriptionFromPhrases,
  markDescriptionEdited,
  onSubcategoryChange,
} from './description-draft.rules';
import { matchCatalogItem, type CatalogFilterItem } from '../catalog-filters';
import { partnerCanCreateKind } from '../../partners-portal/partner-capabilities';
import { RegistryService } from '../../partners-portal/registry/registry.service';

function pass(name: string, detail?: unknown) {
  console.log(`PASS ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`);
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

async function main() {
  console.log('PHASE1_MAIN_START');
  process.env.NODE_ENV = 'test';
  const started = new Date().toISOString();
  const taxonomy = new TaxonomyService();
  taxonomy.onModuleInit();
  const registry = new RegistryService(taxonomy);
  registry.onModuleInit();

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/v1/marketplace/taxonomy/lanes') {
        const aud = url.searchParams.get('audience') === 'partner' ? 'partner' : 'public';
        return send(res, 200, {
          schemaVersion: 1,
          audience: aud,
          lanes: taxonomy.listPublicLanes({ audience: aud }),
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/marketplace/taxonomy') {
        const laneId = (url.searchParams.get('lane') || 'elegance').trim();
        const aud = url.searchParams.get('audience') === 'partner' ? 'partner' : 'public';
        try {
          return send(res, 200, taxonomy.publicProjection({ lane: laneId, audience: aud }));
        } catch (e: any) {
          const code = e?.code || '';
          if (code === 'TAXONOMY_LANE_UNSUPPORTED' || code === 'TAXONOMY_LANE_NOT_PUBLIC') {
            return send(res, 400, {
              messageAr:
                code === 'TAXONOMY_LANE_NOT_PUBLIC'
                  ? 'هذا القسم غير متاح للعامة بعد'
                  : 'مسار التصنيفات غير مدعوم',
              code,
            });
          }
          throw e;
        }
      }
      // Portal editor read path: PartnersApi.registry() → GET /partners-portal/registry
      if (req.method === 'GET' && url.pathname === '/api/v1/partners-portal/registry') {
        return send(res, 200, registry.metaPayload());
      }
      return send(res, 404, { code: 'NOT_FOUND' });
    } catch (e: any) {
      return send(res, 500, { code: 'INTERNAL', message: String(e?.message || e) });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const root = `http://127.0.0.1:${port}`;
  const results: Array<{ id: string; ok: boolean }> = [];

  {
    const pub = await fetch(`${root}/api/v1/marketplace/taxonomy/lanes`);
    assert.equal(pub.status, 200);
    const pubBody = await pub.json();
    const pubIds = (pubBody.lanes || []).map((l: any) => l.id);
    assert.ok(pubIds.includes('elegance'));
    assert.ok(!pubIds.includes('jewelry'), 'jewelry must not be publicBrowse yet');

    const partner = await fetch(`${root}/api/v1/marketplace/taxonomy/lanes?audience=partner`);
    const partnerBody = await partner.json();
    const partnerIds = (partnerBody.lanes || []).map((l: any) => l.id);
    assert.ok(partnerIds.includes('jewelry'));
    assert.ok(partnerIds.includes('children'));
    assert.ok(partnerIds.includes('gifts'));
    assert.ok(partnerIds.includes('occasions'));
    pass('P1-LANES', { public: pubIds, partner: partnerIds });
    results.push({ id: 'P1-LANES', ok: true });
  }

  {
    const res = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.lane, 'elegance');
    assert.ok(Array.isArray(body.nodes) && body.nodes.some((n: any) => n.id === 'clothes'));
    pass('P1-ELEGANCE-COMPAT', { definitionsVersion: body.definitionsVersion });
    results.push({ id: 'P1-ELEGANCE-COMPAT', ok: true });
  }

  {
    const denied = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=jewelry`);
    assert.equal(denied.status, 400);
    const ok = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=jewelry&audience=partner`);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.ok(body.nodes.some((n: any) => n.id === 'jewelry.rings'));
    assert.ok(body.descriptionPhrases?.['jewelry.rings']?.length >= 1);
    pass('P1-JEWELRY-PREVIEW', { definitionsVersion: body.definitionsVersion });
    results.push({ id: 'P1-JEWELRY-PREVIEW', ok: true });
  }

  const probeId = 'jewelry.__phase1_probe__';
  const expectedProfileId = 'product.jewelry';
  const injected = taxonomy.injectTestBranch({
    lane: 'jewelry',
    parentId: 'jewelry',
    id: probeId,
    labelAr: 'فرع تجريبي مرحلة١',
    profileId: expectedProfileId,
  });

  // Expected values from central registry (not hardcoded client lists).
  const expectedProfile = registry.getProfile(expectedProfileId);
  assert.ok(expectedProfile, 'product.jewelry profile missing from registry');
  const expectedFieldIds = [...(expectedProfile!.fields || [])];
  assert.ok(expectedFieldIds.includes('metal'), 'expected metal field on product.jewelry');
  assert.ok(expectedFieldIds.includes('purityKarat'), 'expected purityKarat field');
  const expectedFilterKeys = expectedFieldIds
    .map((fid) => registry.getRegistry().fields[fid]?.filter)
    .filter((f): f is string => typeof f === 'string' && !!f.trim());
  assert.ok(expectedFilterKeys.includes('metal'), 'expected metal filter');
  assert.ok(expectedFilterKeys.includes('purity'), 'expected purity filter from purityKarat');

  // --- Portal editor read path: PartnersApi.taxonomy + PartnersApi.registry ---
  const portalTaxRes = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=jewelry&audience=partner`);
  assert.equal(portalTaxRes.status, 200);
  const portalDoc = await portalTaxRes.json();
  const portalNode = (portalDoc.nodes || []).find((n: any) => n.id === probeId);
  assert.ok(portalNode, 'portal taxonomy path missing probe node');
  assert.equal(portalNode.parentId, 'jewelry');
  assert.equal(portalNode.profileId, expectedProfileId);
  assert.equal(portalDoc.definitionsVersion, injected.definitionsVersion);
  assert.ok(Array.isArray(portalNode.fieldIds) && portalNode.fieldIds.length > 0, 'portal node fieldIds empty');
  assert.ok(Array.isArray(portalNode.filterKeys) && portalNode.filterKeys.length > 0, 'portal node filterKeys empty');
  for (const fid of ['metal', 'purityKarat']) {
    assert.ok(portalNode.fieldIds.includes(fid), `portal missing field ${fid}`);
  }
  assert.ok(portalNode.filterKeys.includes('metal'), 'portal missing metal filter');

  const portalRegRes = await fetch(`${root}/api/v1/partners-portal/registry`);
  assert.equal(portalRegRes.status, 200);
  const portalReg = await portalRegRes.json();
  const portalRegProfile = (portalReg.registry?.profiles || []).find((p: any) => p.id === expectedProfileId);
  assert.ok(portalRegProfile, 'portal registry missing product.jewelry');
  assert.ok(portalRegProfile.fields.includes('metal'));
  assert.equal(portalReg.registry.fields.metal?.filter, 'metal');
  // Cross-check taxonomy enrichment vs registry path the editor uses.
  assert.deepEqual(
    [...portalNode.fieldIds].sort(),
    [...portalRegProfile.fields].sort(),
    'portal taxonomy fieldIds must match PartnersApi.registry profile fields',
  );
  pass('P1-PORTAL-READ-PATH', {
    id: portalNode.id,
    parentId: portalNode.parentId,
    profileId: portalNode.profileId,
    definitionsVersion: portalDoc.definitionsVersion,
    fieldIds: portalNode.fieldIds,
    filterKeys: portalNode.filterKeys,
  });
  results.push({ id: 'P1-PORTAL-READ-PATH', ok: true });

  const flutterCwd = path.resolve(__dirname, '../../../../');
  const flutterBin = process.env.FLUTTER_BIN || '/Users/fayez/flutter/bin/flutter';
  const dartTest = path.join(
    flutterCwd,
    'test/features/marketplace/phase1_taxonomy_live_probe_test.dart',
  );
  assert.ok(fs.existsSync(dartTest), 'missing dart probe test file');
  const apiBase = `${root}/api/v1`;
  const expectedFieldsCsv = expectedFieldIds.join(',');
  const expectedFiltersCsv = [...new Set(expectedFilterKeys)].join(',');
  const flutterRun = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      flutterBin,
      [
        'test',
        '--reporter',
        'expanded',
        `--dart-define=MIRA_API_BASE_URL=${apiBase}`,
        '--dart-define=USE_MIRA_API=true',
        `--dart-define=PHASE1_PROBE_ID=${probeId}`,
        `--dart-define=PHASE1_PROBE_PARENT=jewelry`,
        `--dart-define=PHASE1_PROBE_VERSION=${injected.definitionsVersion}`,
        `--dart-define=PHASE1_PROBE_PROFILE=${expectedProfileId}`,
        `--dart-define=PHASE1_PROBE_FIELDS=${expectedFieldsCsv}`,
        `--dart-define=PHASE1_PROBE_FILTERS=${expectedFiltersCsv}`,
        'test/features/marketplace/phase1_taxonomy_live_probe_test.dart',
      ],
      {
        cwd: flutterCwd,
        env: {
          ...process.env,
          PATH: `/Users/fayez/flutter/bin:${process.env.PATH || ''}`,
        },
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ status: 124, stdout, stderr: stderr + '\nTIMEOUT' });
    }, 240000);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
  if (flutterRun.status !== 0) {
    console.error(flutterRun.stdout);
    console.error(flutterRun.stderr);
  }
  assert.equal(flutterRun.status, 0, 'Flutter live taxonomy probe failed');
  // Capture Flutter-reported payload from stdout marker.
  const flutterMarker = flutterRun.stdout.match(/PHASE1_FLUTTER_READ=(\{.*\})/);
  assert.ok(flutterMarker, 'Flutter probe must print PHASE1_FLUTTER_READ JSON');
  const flutterPayload = JSON.parse(flutterMarker![1]);
  assert.equal(flutterPayload.id, probeId);
  assert.equal(flutterPayload.parentId, 'jewelry');
  assert.equal(flutterPayload.profileId, expectedProfileId);
  assert.equal(String(flutterPayload.definitionsVersion), String(injected.definitionsVersion));
  assert.ok((flutterPayload.fieldIds || []).includes('metal'));
  assert.ok((flutterPayload.filterKeys || []).includes('metal'));
  pass('P1-FLUTTER-READ-PATH', flutterPayload);
  results.push({ id: 'P1-FLUTTER-READ-PATH', ok: true });

  {
    const badAll = taxonomy.validateWrite(
      { category: 'jewelry', subcategory: 'jewelry.all', profileId: 'product.jewelry' },
      'jewelry',
    );
    assert.ok(badAll.length, 'browseOnly must be rejected');
    const badParent = taxonomy.validateWrite(
      { category: 'jewelry', subcategory: 'children.clothes', profileId: 'product.jewelry' },
      'jewelry',
    );
    assert.ok(badParent.length, 'cross-lane/wrong parent must be rejected');
    const okRing = taxonomy.validateWrite(
      { category: 'jewelry', subcategory: 'jewelry.rings', profileId: 'product.jewelry' },
      'jewelry',
    );
    assert.equal(okRing.length, 0);
    pass('P1-WRITE-VALIDATE');
    results.push({ id: 'P1-WRITE-VALIDATE', ok: true });
  }

  {
    const composed = composeDescriptionFromPhrases(
      ['jr1'],
      taxonomy.phrasesFor('jewelry.rings'),
    );
    const dirty = markDescriptionEdited(
      { descriptionAr: composed, descriptionPhraseIds: ['jr1'], descriptionDirty: false },
      'وصف يدوي يبقى بعد تغيير الفرع',
    );
    const after = onSubcategoryChange(dirty, taxonomy.phrasesFor('jewelry.necklaces'));
    assert.equal(after.state.descriptionAr, 'وصف يدوي يبقى بعد تغيير الفرع');
    assert.equal(after.replaced, false);
    pass('P1-DESCRIPTION-PERSIST');
    results.push({ id: 'P1-DESCRIPTION-PERSIST', ok: true });
  }

  {
    assert.equal(partnerCanCreateKind('event_planner', 'service'), true);
    assert.equal(partnerCanCreateKind('event_planner', 'product'), false);
    assert.equal(partnerCanCreateKind('event_planner', 'product', { canSellProducts: true }), true);
    pass('P1-EVENT-PLANNER-CAPS');
    results.push({ id: 'P1-EVENT-PLANNER-CAPS', ok: true });
  }

  {
    const doc = await (
      await fetch(`${root}/api/v1/marketplace/taxonomy?lane=occasions&audience=partner`)
    ).json();
    const favors = doc.nodes.find((n: any) => n.id === 'occasions.favors');
    const styling = doc.nodes.find((n: any) => n.id === 'occasions.styling');
    assert.equal(favors.offerKind, 'product');
    assert.equal(styling.offerKind, 'service');
    pass('P1-OCCASIONS-KIND-SPLIT');
    results.push({ id: 'P1-OCCASIONS-KIND-SPLIT', ok: true });
  }

  {
    const item: CatalogFilterItem = {
      kind: 'product',
      id: 'x1',
      partnerId: 'p',
      partnerType: 'brand',
      partnerNameAr: 'ب',
      city: 'الرياض',
      nameAr: 'قلادة',
      nameEn: 'n',
      category: 'jewelry',
      subcategory: 'jewelry.necklaces',
      concernTags: [],
      priceHalalas: 100,
      attributesJson: { giftEligible: true },
    };
    assert.ok(matchCatalogItem(item, { lane: 'gifts' }));
    pass('P1-GIFT-CROSS-SMOKE');
    results.push({ id: 'P1-GIFT-CROSS-SMOKE', ok: true });
  }

  server.close();

  const summary = {
    phase: 'PHASE_1',
    verdict: results.every((r) => r.ok) ? 'PHASE_1_CLOSED_VERIFIED_LOCAL' : 'PHASE_1_PARTIAL',
    started,
    finished: new Date().toISOString(),
    root,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.verdict !== 'PHASE_1_CLOSED_VERIFIED_LOCAL') process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
