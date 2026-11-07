#!/usr/bin/env node
/**
 * E1 preferred rollback proof: run a real pre-E1 app build against a DB that already
 * has E1 additive columns + taxonomy data written by the new app.
 *
 * Previous SHA: 60d9134294f6db96bc0c55685066dc49301833ae
 * Reason: last origin/main tip before E1 taxonomy columns entered Prisma/schema —
 * represents the preferred "redeploy prior app, keep additive columns" rollback target.
 *
 * Requires:
 *   PREV_APP_DIST  — path to built previous mira-api (contains dist/main.js)
 *   NEW_APP_DIST   — path to built current mira-api (optional; defaults to ../dist)
 *   DATABASE_URL   — local test DB with E1 columns already applied
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const PREV_SHA = '60d9134294f6db96bc0c55685066dc49301833ae';
const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.error('REFUSE: local DATABASE_URL required');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const newDist = resolve(process.env.NEW_APP_DIST || join(__dirname, '../dist'));
const prevDist = resolve(process.env.PREV_APP_DIST || '/tmp/mira-e1-prev-60d9134/mira-api/dist');

if (!existsSync(join(newDist, 'main.js'))) {
  console.error('BLOCKED: new app dist missing at', newDist);
  process.exit(2);
}
if (!existsSync(join(prevDist, 'main.js'))) {
  console.error('BLOCKED: previous app dist missing at', prevDist, '— build SHA', PREV_SHA, 'first');
  process.exit(2);
}

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function readJson(res) {
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

function startApp({ distDir, port, label }) {
  const child = spawn(process.execPath, [join(distDir, 'main.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: url,
      MIRA_PARTNER_EDITOR_V2: 'true',
      ADMIN_API_KEY: 'e1-rollback-admin',
      AUTH_SKIP: 'false',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: dirname(distDir),
  });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d.toString();
  });
  child.stderr.on('data', (d) => {
    log += d.toString();
  });
  return {
    label,
    port,
    child,
    getLog: () => log,
    async waitReady(ms = 20000) {
      const start = Date.now();
      while (Date.now() - start < ms) {
        if (child.exitCode != null) {
          throw new Error(`${label} exited early code=${child.exitCode}\n${log.slice(-2000)}`);
        }
        try {
          const r = await fetch(`http://127.0.0.1:${port}/api/v1/marketplace/cities`);
          if (r.status > 0) return;
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(`${label} boot timeout\n${log.slice(-2000)}`);
    },
    async stop() {
      if (child.exitCode != null) return;
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (child.exitCode == null) child.kill('SIGKILL');
    },
  };
}

async function snapshot(productId, mediaId) {
  const product = await prisma.$queryRawUnsafe(
    `SELECT id, partner_id, price_halalas, stock_qty, name_ar, category, subcategory,
            profile_id, attributes_json, options_json, variants_json,
            draft_taxonomy_set, draft_subcategory, draft_attributes_json
     FROM products WHERE id=$1`,
    productId,
  );
  const media = await prisma.$queryRawUnsafe(
    `SELECT id, owner_id, owner_kind, kind FROM catalog_media WHERE id=$1`,
    mediaId,
  );
  return { product: product[0], media: media[0] };
}

async function main() {
  const started = new Date().toISOString();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `RB ${suffix}`, nameEn: 'RB', city: 'الرياض' },
  });
  const token = `token-rb-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `rb-${suffix}@test.local`, accessToken: token },
  });

  let newApp;
  let prevApp;
  let productId;
  let mediaId;
  try {
    // —— 1) New app writes taxonomy on migrated DB ——
    newApp = startApp({ distDir: newDist, port: 39811, label: 'NEW' });
    await newApp.waitReady();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = await readJson(
      await fetch(`http://127.0.0.1:${newApp.port}/api/v1/partners-portal/products`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          nameAr: `رجوع ${suffix}`,
          priceHalalas: 5555,
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributes: { material: ['silk'] },
          externalUrl: 'https://example.test/rb',
          optionsJson: [{ id: 'color', nameAr: 'لون', values: [{ id: 'black', labelAr: 'أسود' }] }],
          variantsJson: [{ id: 'v1', selections: { color: 'black' }, available: true, priceHalalas: 5555 }],
          stockQty: 4,
        }),
      }),
    );
    assert.ok(created.status === 200 || created.status === 201, created.text);
    productId = created.json.id;
    const media = await readJson(
      await fetch(`http://127.0.0.1:${newApp.port}/api/v1/partners-portal/products/${productId}/media`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
      }),
    );
    assert.ok(media.status === 200 || media.status === 201, media.text);
    mediaId = media.json.id || media.json.mediaId;
    assert.ok(mediaId, media.text);

    const before = await snapshot(productId, mediaId);
    assert.equal(before.product.subcategory, 'clothes.abaya');
    assert.deepEqual(before.product.attributes_json, { material: ['silk'] });
    assert.equal(Number(before.product.price_halalas), 5555);
    assert.equal(Number(before.product.stock_qty), 4);
    assert.equal(before.media.owner_id, productId);

    await newApp.stop();
    newApp = null;

    // —— 2) Previous app on same DB ——
    prevApp = startApp({ distDir: prevDist, port: 39812, label: 'PREV' });
    await prevApp.waitReady();

    const preview = await readJson(
      await fetch(`http://127.0.0.1:${prevApp.port}/api/v1/partners-portal/products/${productId}/preview`, {
        headers: auth,
      }),
    );
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.json.id, productId);
    assert.equal(preview.json.priceHalalas, 5555);

    const patch = await readJson(
      await fetch(`http://127.0.0.1:${prevApp.port}/api/v1/partners-portal/products/${productId}`, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ nameAr: `رجوع بعد ${suffix}` }),
      }),
    );
    assert.equal(patch.status, 200, patch.text);

    const mid = await snapshot(productId, mediaId);
    assert.equal(mid.product.name_ar, `رجوع بعد ${suffix}`);
    assert.equal(mid.product.partner_id, brand.id);
    assert.equal(Number(mid.product.price_halalas), 5555);
    assert.equal(Number(mid.product.stock_qty), 4);
    assert.deepEqual(mid.product.options_json, before.product.options_json);
    assert.deepEqual(mid.product.variants_json, before.product.variants_json);
    // E1 columns preserved (previous app does not clear them).
    assert.equal(mid.product.subcategory, 'clothes.abaya');
    assert.deepEqual(mid.product.attributes_json, { material: ['silk'] });
    assert.equal(mid.media.owner_id, productId);

    await prevApp.stop();
    prevApp = null;

    // —— 3) New app again — taxonomy still readable/writable ——
    newApp = startApp({ distDir: newDist, port: 39813, label: 'NEW2' });
    await newApp.waitReady();
    const preview2 = await readJson(
      await fetch(`http://127.0.0.1:${newApp.port}/api/v1/partners-portal/products/${productId}/preview`, {
        headers: auth,
      }),
    );
    assert.equal(preview2.status, 200, preview2.text);
    assert.equal(preview2.json.publishedSubcategory, 'clothes.abaya');
    assert.deepEqual(preview2.json.publishedAttributes, { material: ['silk'] });

    const patchTax = await readJson(
      await fetch(`http://127.0.0.1:${newApp.port}/api/v1/partners-portal/products/${productId}`, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ attributes: { material: ['cotton'] } }),
      }),
    );
    assert.equal(patchTax.status, 200, patchTax.text);
    const after = await snapshot(productId, mediaId);
    assert.deepEqual(after.product.attributes_json, { material: ['cotton'] });
    assert.equal(after.product.name_ar, `رجوع بعد ${suffix}`);
    assert.equal(Number(after.product.price_halalas), 5555);

    console.log(
      JSON.stringify(
        {
          verdict: 'E1_PREVIOUS_APP_ROLLBACK_PROOF_PASS',
          started,
          ended: new Date().toISOString(),
          previousSha: PREV_SHA,
          previousReason:
            'Pre-E1 tip of origin/main before taxonomy columns entered the Prisma schema — preferred redeploy-prior-app rollback target with additive columns kept.',
          previousDist: prevDist,
          newDist,
          productId,
          partnerId: brand.id,
          mediaId,
          checks: {
            previousPreview: preview.status,
            previousPatchName: patch.status,
            e1ColumnsPreservedAfterPrevious: true,
            newRereadAndWrite: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (newApp) await newApp.stop().catch(() => undefined);
    if (prevApp) await prevApp.stop().catch(() => undefined);
    if (productId) {
      await prisma.catalogMedia.deleteMany({ where: { ownerId: productId } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({ where: { partnerId: brand.id } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: brand.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
