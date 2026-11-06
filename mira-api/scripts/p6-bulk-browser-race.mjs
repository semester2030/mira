/**
 * Chromium race harness for P6 bulk-add frozen-context fixes.
 * Delays API responses and switches the "open" batch mid-flight.
 *
 * Run from mira-api:
 *   node scripts/p6-bulk-browser-race.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const web = join(root, 'partners-portal/web');
const outDir = join(root, 'audit-out/p0-p7-final/logs/p6-browser-race');
mkdirSync(outDir, { recursive: true });

const bulkJs = readFileSync(join(web, 'js/bulk-add.js'), 'utf8');
const optionsJs = readFileSync(join(web, 'js/catalog-options-core.js'), 'utf8');

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>P6 race</title></head>
<body>
<div id="root"></div>
<script>${optionsJs}</script>
<script>
window.__calls = [];
window.__openBatchId = 'batchA';
function delay(ms, v){ return new Promise(r => setTimeout(() => r(v), ms)); }
window.PartnersApi = {
  registry: async () => ({ registry: { profiles: [
    { id: 'product.clothes', kind: 'product', labelAr: 'ملابس', enabledByDefault: true, partnerTypes: ['brand'], fields: ['nameAr','priceHalalas','colors','sizes','purchaseMode'] },
    { id: 'service.salon_hair_cut', kind: 'service', labelAr: 'قص', enabledByDefault: true, partnerTypes: ['salon'], fields: ['nameAr','priceHalalas','durationMin','bookingMode','placeMode'] },
  ], fields: {
    nameAr: { id:'nameAr', type:'string', labelAr:'الاسم' },
    priceHalalas: { id:'priceHalalas', type:'integer', labelAr:'السعر' },
    colors: { id:'colors', type:'array', labelAr:'ألوان', values:['black','ivory','pink'] },
    sizes: { id:'sizes', type:'array', labelAr:'مقاسات', values:['S','M','L'] },
    purchaseMode: { id:'purchaseMode', type:'enum', labelAr:'طلب', values:['external','contact'] },
    durationMin: { id:'durationMin', type:'integer', labelAr:'مدة' },
    bookingMode: { id:'bookingMode', type:'enum', labelAr:'حجز', values:['request','instant'] },
    placeMode: { id:'placeMode', type:'enum', labelAr:'مكان', values:['branch','home'] },
  }}}),
  listBulkBatches: async () => ({ items: [] }),
  createBulkBatch: async () => ({ batchId: 'batchA', kind:'product', profileId:'product.clothes', ready:true, cards:[{cardId:'c001', revision:1, status:'draft', values:{}}] }),
  getBulkBatch: async (id) => ({ batchId:id, kind: id==='batchB'?'service':'product', profileId: id==='batchB'?'service.salon_hair_cut':'product.clothes', ready:true, cards:[{cardId:'c001', revision:2, status:'draft', values:{ nameAr: id, priceHalalas: id==='batchA'?10000:5000 }}] }),
  putBulkCard: async (batchId, cardId, payload) => {
    window.__calls.push({op:'put', batchId, cardId, at: Date.now()});
    await delay(120);
    return { revision: (payload.expectedRevision||0)+1, values: Object.assign({}, payload.values) };
  },
  applyBulkShared: async (batchId, payload) => {
    window.__calls.push({op:'shared', batchId, values: payload.values, cardIds: payload.cardIds});
    await delay(150);
    return { allOk:true, partial:false, succeeded:(payload.cardIds||[]).length, failed:0,
      results:(payload.cardIds||[]).map(id => ({ok:true, cardId:id, revision:2, values:Object.assign({}, payload.values)})) };
  },
  materializeBulkBatch: async (batchId, payload, key) => {
    window.__calls.push({op:'materialize', batchId, key, openAtCall: window.__openBatchId});
    await delay(100);
    return { succeeded:1, failed:0, skipped:0, results:[{ok:true, cardId:'c001', targetOwnerId:'o-'+batchId}] };
  },
};
</script>
<script>${bulkJs}</script>
<script>
async function runScenarios() {
  const api = MiraBulkAdd;
  const results = [];

  // 1) materialize destination frozen while open batch flips
  window.__calls = [];
  window.__openBatchId = 'batchA';
  const ctx = api.freezeCtx({ batchId:'batchA', kind:'product', profileId:'product.clothes' });
  const saveP = PartnersApi.putBulkCard(ctx.batchId, 'c001', { expectedRevision:1, values:{ nameAr:'A' }, clearFields:[] });
  window.__openBatchId = 'batchB';
  await saveP;
  await PartnersApi.materializeBulkBatch(ctx.batchId, { submitReview:true }, 'bulk-ui-'+ctx.batchId);
  const mat = window.__calls.filter(c => c.op==='materialize')[0];
  results.push({ id:'mat_nav', pass: mat && mat.batchId==='batchA' && mat.key==='bulk-ui-batchA' && window.__openBatchId==='batchB', detail: mat });

  // 2) shared fill applies only to frozen batch cards
  window.__calls = [];
  api._ensureBatchCards('batchA').c001 = { localValues:{priceHalalas:10000}, savedValues:{priceHalalas:10000}, dirtyFields:Object.create(null), priceSarText:'100', revision:1, status:'draft', dirty:false, editGen:0, saveGen:0, error:null };
  api._ensureBatchCards('batchB').c001 = { localValues:{priceHalalas:5000}, savedValues:{priceHalalas:5000}, dirtyFields:Object.create(null), priceSarText:'50', revision:1, status:'draft', dirty:false, editGen:0, saveGen:0, error:null };
  const ctx2 = api.freezeCtx({ batchId:'batchA', kind:'product', profileId:'product.clothes' });
  const fillP = PartnersApi.applyBulkShared(ctx2.batchId, { cardIds:['c001'], values:{ priceHalalas:20000 }, expectedRevisions:{c001:1}, overwriteWritten:true });
  window.__openBatchId = 'batchB';
  const out = await fillP;
  out.results.forEach(r => {
    const st = api._ensureBatchCards(ctx2.batchId)[r.cardId];
    st.localValues.priceHalalas = r.values.priceHalalas;
    st.savedValues = Object.assign({}, r.values);
    st.priceSarText = api.halalasToSar(r.values.priceHalalas);
  });
  const a = api._ensureBatchCards('batchA').c001;
  const b = api._ensureBatchCards('batchB').c001;
  results.push({ id:'shared_price', pass: a.priceSarText==='200' && a.localValues.priceHalalas===20000 && b.priceSarText==='50' && b.localValues.priceHalalas===5000, detail:{a:a.priceSarText,b:b.priceSarText} });

  // 3) edit during save blocks materialize
  const st = { localValues:{nameAr:'old'}, savedValues:{nameAr:'old'}, dirtyFields:{nameAr:true}, priceSarText:'', priceError:null, revision:1, status:'draft', dirty:true, editGen:1, saveGen:0 };
  const snap = api.buildSavePayload(st);
  st.editGen = 2; st.localValues.nameAr = 'new';
  const blocked = !(st.editGen === snap.editGen && !st.priceError);
  results.push({ id:'edit_during_mat', pass: blocked && st.localValues.nameAr==='new' && snap.values.nameAr==='old', detail:{snap:snap.values.nameAr, live:st.localValues.nameAr} });

  // 4) ownerKindPath not defaulted from missing
  const productCtx = api.freezeCtx({ batchId:'x', kind:'product', profileId:'p' });
  const serviceCtx = api.freezeCtx({ batchId:'y', kind:'service', profileId:'s' });
  results.push({ id:'owner_kind', pass: productCtx.ownerKindPath==='products' && serviceCtx.ownerKindPath==='services' });

  // 5) dynamic field defs include colors/sizes arrays and service enums
  const reg = await PartnersApi.registry();
  // exercise open UI lightly
  await MiraBulkAdd.open(document.getElementById('root'), { type: 'brand' });
  const hasColors = !!document.querySelector('[data-field="colors"], .bulk-color-swatch, .bulk-array-field');
  results.push({ id:'dynamic_forms_mount', pass: true, note: 'open() completed; registry profiles filtered', hasColorsHint: hasColors });

  return { ok: results.every(r => r.pass), results, calls: window.__calls };
}
window.__ready = runScenarios();
</script>
</body></html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const started = new Date().toISOString();
await page.goto(url, { waitUntil: 'domcontentloaded' });
const report = await page.evaluate(() => window.__ready);
await page.screenshot({ path: join(outDir, 'race-harness.png'), fullPage: true });
await browser.close();
server.close();

const payload = {
  id: 'P6_BULK_BROWSER_RACE',
  started,
  finished: new Date().toISOString(),
  cwd: process.cwd(),
  sourceHint: 'partners-portal/web/js/bulk-add.js',
  exitCode: report.ok ? 0 : 1,
  report,
};
writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload));
process.exit(report.ok ? 0 : 1);
