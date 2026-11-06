/**
 * Real portal UI acceptance for bulk-add: clicks buttons, fills inputs, delays network.
 * Does NOT call MiraBulkAdd helpers as substitutes for user actions (except reading exports for asserts).
 *
 * Run: node scripts/p6-bulk-portal-ui-acceptance.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const web = join(root, 'partners-portal/web');
const outDir = join(root, 'audit-out/p0-p7-final/logs/p6-portal-ui-acceptance');
mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

const harness = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>P6 UI accept</title>
<style>
body{font-family:sans-serif;padding:12px}
.btn{margin:4px;padding:6px 10px}
.bulk-card{border:1px solid #ccc;margin:8px;padding:8px}
input,select{margin:2px}
</style></head>
<body>
<button type="button" id="openBulk" class="btn">إضافة مجموعة</button>
<div id="bulkRoot"></div>
<script src="/js/catalog-options-core.js"></script>
<script>
window.__calls=[];
window.__delayMs=120;
window.__sessions=Object.create(null);
window.__batches=Object.create(null);
function delay(ms,v){return new Promise(r=>setTimeout(()=>r(v), ms==null?window.__delayMs:ms));}
function mkBatch(id,kind){
  const profileId=kind==='service'?'service.salon_hair_cut':'product.clothes';
  return {batchId:id,kind,profileId,ready:true,cards:[{cardId:'c001',revision:1,status:'draft',values:{},targetOwnerId:null}]};
}
window.__batches.batchA=mkBatch('batchA','product');
window.__batches.batchB=mkBatch('batchB','product');
window.PartnersApi={
  isLoggedIn:()=>true,
  clearSession(){},
  registry:async()=>({registry:{profiles:[
    {id:'product.clothes',kind:'product',labelAr:'ملابس',enabledByDefault:true,partnerTypes:['brand','developer'],fields:['nameAr','priceHalalas','colors','sizes','purchaseMode','externalUrl']},
  ],fields:{
    nameAr:{id:'nameAr',type:'string',labelAr:'الاسم'},
    priceHalalas:{id:'priceHalalas',type:'integer',labelAr:'السعر'},
    colors:{id:'colors',type:'array',labelAr:'ألوان',values:['black','ivory','pink','blue']},
    sizes:{id:'sizes',type:'array',labelAr:'مقاسات',values:['XS','S','M','L']},
    purchaseMode:{id:'purchaseMode',type:'enum',labelAr:'طلب',values:['external','internal_cod','contact']},
    externalUrl:{id:'externalUrl',type:'string',labelAr:'رابط'},
  }}}),
  listBulkBatches:async()=>({items:Object.keys(window.__batches).map(id=>{const b=window.__batches[id];return {batchId:id,kind:b.kind,cardCount:b.cards.length,materializedCount:b.cards.filter(c=>c.status==='materialized').length};})}),
  createBulkBatch:async(body)=>{
    window.__calls.push({op:'create',body});
    await delay();
    const id=body.batchId||('b'+Date.now());
    window.__batches[id]=mkBatch(id,body.kind||'product');
    window.__batches[id].profileId=body.profileId;
    return window.__batches[id];
  },
  getBulkBatch:async(id)=>{await delay(40); return JSON.parse(JSON.stringify(window.__batches[id]));},
  putBulkCard:async(batchId,cardId,payload)=>{
    window.__calls.push({op:'put',batchId,cardId,values:payload.values,expectedRevision:payload.expectedRevision});
    await delay(window.__putDelay||window.__delayMs);
    const b=window.__batches[batchId];
    const c=b.cards.find(x=>x.cardId===cardId);
    if(c.status==='materialized'){ const e=new Error('محوّلة'); e.code='BULK_CARD_MATERIALIZED'; throw e; }
    c.revision=(payload.expectedRevision||c.revision)+1;
    c.values=Object.assign({},c.values||{},payload.values||{});
    (payload.clearFields||[]).forEach(k=>delete c.values[k]);
    return {revision:c.revision,values:Object.assign({},c.values)};
  },
  applyBulkShared:async(batchId,payload)=>{
    window.__calls.push({op:'shared',batchId,values:payload.values,previewOnly:!!payload.previewOnly});
    await delay(window.__sharedDelay||150);
    if(payload.previewOnly){
      return {preview:true,perCard:(payload.cardIds||[]).map(id=>({cardId:id,revision:payload.expectedRevisions[id],willSet:Object.keys(payload.values||{})}))};
    }
    const b=window.__batches[batchId];
    const results=(payload.cardIds||[]).map(id=>{
      const c=b.cards.find(x=>x.cardId===id);
      if(payload.expectedRevisions&&payload.expectedRevisions[id]!==c.revision){
        return {ok:false,cardId:id,error:{code:'BULK_PREVIEW_REVISION_DRIFT'}};
      }
      c.revision+=1;
      c.values=Object.assign({},c.values||{},payload.values||{});
      return {ok:true,cardId:id,revision:c.revision,values:Object.assign({},c.values)};
    });
    const failed=results.filter(r=>!r.ok).length;
    return {allOk:failed===0,partial:failed>0&&failed<results.length,succeeded:results.length-failed,failed,results};
  },
  materializeBulkBatch:async(batchId,payload,key)=>{
    window.__calls.push({op:'materialize',batchId,key,cardIds:payload&&payload.cardIds,failedOnly:!!(payload&&payload.failedOnly)});
    await delay(window.__matDelay||180);
    const b=window.__batches[batchId];
    const targets=(payload&&payload.cardIds)||b.cards.map(c=>c.cardId);
    const results=targets.map(id=>{
      const c=b.cards.find(x=>x.cardId===id);
      if(c.status==='materialized'&&c.targetOwnerId){
        return {ok:true,skipped:true,cardId:id,targetOwnerId:c.targetOwnerId};
      }
      c.status='materialized';
      c.targetOwnerId='own-'+batchId+'-'+id;
      c.openUrl='/dashboard.html?edit=product:'+c.targetOwnerId;
      return {ok:true,cardId:id,targetOwnerId:c.targetOwnerId};
    });
    return {succeeded:results.filter(r=>r.ok&&!r.skipped).length,failed:0,skipped:results.filter(r=>r.skipped).length,results};
  },
  getUploadSession:async(sessionId)=>{
    window.__calls.push({op:'getSession',sessionId});
    await delay(30);
    const s=window.__sessions[sessionId];
    if(!s){const e=new Error('nf');e.code='NOT_FOUND';e.status=404;throw e;}
    return Object.assign({},s);
  },
  uploadViaSession:async(kind,id,file,hooks)=>{
    window.__calls.push({op:'upload',kind,id,hasFile:!!file,sessionId:hooks&&hooks.sessionId});
    await delay(80);
    const sid=(hooks&&hooks.sessionId)||('sess-'+Math.random().toString(36).slice(2,8));
    if(hooks&&hooks.onSession) hooks.onSession({sessionId:sid,declaredChecksum:'chk'});
    if(hooks&&hooks.onProcessing) hooks.onProcessing();
    if(window.__forceVerifyPending){
      window.__sessions[sid]={sessionId:sid,status:'verifying',ownerKind:kind==='products'?'product':'service',ownerId:id,declaredChecksum:'chk',declaredByteSize:file&&file.size};
      const e=new Error('verify pending'); e.code='verify_pending'; e.body=window.__sessions[sid]; throw e;
    }
    window.__sessions[sid]={sessionId:sid,status:'ready',catalogMediaId:'media-'+sid,ownerKind:kind==='products'?'product':'service',ownerId:id,declaredChecksum:'chk',declaredByteSize:file&&file.size};
    return window.__sessions[sid];
  },
  sha256FileIncremental:async()=>'chk',
};
</script>
<script src="/js/bulk-add.js"></script>
<script>
document.getElementById('openBulk').onclick=()=>{
  MiraBulkAdd.open(document.getElementById('bulkRoot'),{type:'brand'});
};
</script>
</body></html>`;

const server = createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1');
  if (u.pathname === '/' || u.pathname === '/harness.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(harness);
    return;
  }
  const file = join(web, u.pathname.replace(/^\//, ''));
  if (!file.startsWith(web) || !existsSync(file)) {
    res.writeHead(404);
    res.end('nf');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const started = new Date().toISOString();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('dialog', async (d) => {
  try {
    await d.accept();
  } catch (_) {}
});
const results = [];
const pass = (id, ok, detail) => {
  results.push({ id, pass: !!ok, detail });
};

async function shot(name) {
  await page.screenshot({ path: join(outDir, name + '.png'), fullPage: true });
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.click('#openBulk');
  await page.waitForSelector('#bulkStatus');

  // Open batch A via list button text containing batchA
  await page.evaluate(() => {
    window.__delayMs = 150;
    window.__matDelay = 400;
    window.__putDelay = 300;
  });
  // create via UI
  await page.selectOption('#bulkKind', 'product');
  await page.fill('#bulkCount', '1');
  // Use existing batch open: click batchA from list after reload list — openBulk already loadMyBatches
  await page.click('button:has-text("batchA")');
  await page.waitForSelector('.bulk-card');

  // Fill name + price
  const nameInput = page.locator('.bulk-card input[type="text"]').first();
  await nameInput.fill('فستان A');
  // price field has placeholder ريال
  await page.locator('.bulk-card input[placeholder="ريال"]').first().fill('100');

  // S01: click save then materialize, switch to B while put delayed
  const matPromise = page.click('button:has-text("حفظ ثم تحويل الدفعة")');
  await page.waitForTimeout(80);
  // navigate to B during delay
  await page.click('button:has-text("batchB")');
  await matPromise.catch(() => {});
  await page.waitForTimeout(500);
  const calls1 = await page.evaluate(() => window.__calls.filter((c) => c.op === 'materialize'));
  pass('UI_S01_mat_stays_A', calls1.some((c) => c.batchId === 'batchA') && !calls1.some((c) => c.batchId === 'batchB'), calls1);

  // Re-open A for shared fill price 200
  await page.click('button:has-text("batchA")');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = window.__batches.batchA;
    if (b && b.cards[0].status === 'materialized') {
      b.cards[0].status = 'draft';
      b.cards[0].targetOwnerId = null;
      b.cards[0].values = { nameAr: 'فستان A', priceHalalas: 10000 };
      b.cards[0].revision = 2;
    }
  });
  await page.click('button:has-text("batchA")');
  await page.waitForSelector('.bulk-card');
  await page.fill('input[placeholder="سعر مشترك (ريال)"]', '200');
  await page.evaluate(() => {
    window.__sharedDelay = 250;
  });
  const sharedClick = page.click('button:has-text("تعبئة مشتركة")');
  await page.waitForTimeout(50);
  await page.click('button:has-text("batchB")');
  await sharedClick.catch(() => {});
  await page.waitForTimeout(400);
  const sharedCalls = await page.evaluate(() => window.__calls.filter((c) => c.op === 'shared' && !c.previewOnly));
  const priceState = await page.evaluate(() => {
    const a = MiraBulkAdd._ensureBatchCards('batchA').c001;
    const b = MiraBulkAdd._ensureBatchCards('batchB').c001;
    return {
      aPrice: a && a.priceSarText,
      aHal: a && a.localValues && a.localValues.priceHalalas,
      bPrice: b && b.priceSarText,
      sharedBatch: window.__calls.filter((c) => c.op === 'shared' && !c.previewOnly).slice(-1)[0],
    };
  });
  pass(
    'UI_S02_shared_price',
    sharedCalls.every((c) => c.batchId === 'batchA') &&
      priceState.aHal === 20000 &&
      String(priceState.aPrice) === '200',
    priceState,
  );

  // Variants: open A, wait for getBulkBatch+render to finish (avoid stale DOM handlers).
  await page.click('button:has-text("batchA")');
  await page.waitForFunction(() => {
    const card = document.querySelector('.bulk-card[data-batch="batchA"]');
    const sw = document.querySelectorAll('.bulk-array-field[data-field="colors"] button.bulk-color-swatch');
    const st = window.MiraBulkAdd && MiraBulkAdd._ensureBatchCards('batchA').c001;
    return !!(card && sw.length >= 4 && st && st.status !== 'materialized' && !st.commitLocked);
  });
  await page.waitForTimeout(80);
  // Click first 4 colors + 4 sizes via real button/checkbox handlers.
  const selectedCounts = await page.evaluate(() => {
    const swatches = [
      ...document.querySelectorAll('.bulk-array-field[data-field="colors"] button.bulk-color-swatch'),
    ];
    const boxes = [
      ...document.querySelectorAll('.bulk-array-field[data-field="sizes"] input[type="checkbox"]'),
    ];
    for (const sw of [...swatches].filter((s) => s.classList.contains('is-on'))) sw.click();
    for (const box of boxes) {
      if (box.checked) box.click();
    }
    for (let i = 0; i < Math.min(4, swatches.length); i++) swatches[i].click();
    for (let i = 0; i < Math.min(4, boxes.length); i++) {
      if (!boxes[i].checked) boxes[i].click();
    }
    const st0 = MiraBulkAdd._ensureBatchCards('batchA').c001;
    return {
      colors: (st0.localValues.colors || []).length,
      sizes: (st0.localValues.sizes || []).length,
      colorIds: st0.localValues.colors || [],
      sizeIds: st0.localValues.sizes || [],
      swatchDom: swatches.length,
      locked: !!(st0.commitLocked || st0.status === 'materialized'),
    };
  });
  pass('UI_S05_select_4x4', selectedCounts.colors === 4 && selectedCounts.sizes === 4, selectedCounts);
  await page.click('button:has-text("توليد التركيبات")');
  await page.waitForTimeout(100);
  const vCount1 = await page.evaluate(() => {
    const st = MiraBulkAdd._ensureBatchCards('batchA').c001;
    return (st.localValues.variantsJson || []).length;
  });
  const shownAfterGen = await page.locator('.bulk-variant-row').count();
  pass('UI_S05_all_variants', shownAfterGen === vCount1 && vCount1 === 16, {
    shown: shownAfterGen,
    totalV: vCount1,
  });
  // edit last (16th) variant + first: price 45 / qty 7 on first
  const vPrice = page.locator('.bulk-variant-row input[placeholder="سعر التركيبة (ريال)"]').first();
  await vPrice.fill('45');
  const vQty = page.locator('.bulk-variant-row input[placeholder^="كمية"]').first();
  await vQty.fill('7');
  if (shownAfterGen >= 16) {
    await page
      .locator('.bulk-variant-row')
      .nth(15)
      .locator('input[placeholder="سعر التركيبة (ريال)"]')
      .fill('33');
  }
  await page.click('button:has-text("توليد التركيبات")');
  await page.waitForTimeout(100);
  const afterRegen = await page.evaluate(() => {
    const vs = MiraBulkAdd._ensureBatchCards('batchA').c001.localValues.variantsJson || [];
    const first = vs[0];
    const last = vs[15];
    return {
      n: vs.length,
      price: first && first.priceHalalas,
      qty: first && first.stockQty,
      id: first && first.id,
      lastPrice: last && last.priceHalalas,
    };
  });
  pass(
    'UI_S04_variant_preserve',
    afterRegen.n === vCount1 &&
      afterRegen.price === 4500 &&
      afterRegen.qty === 7 &&
      (vCount1 < 16 || afterRegen.lastPrice === 3300),
    { vCount1, afterRegen },
  );

  // invalid variant price blocks materialize
  await vPrice.fill('999x');
  await page.waitForTimeout(50);
  await page.click('button:has-text("حفظ ثم تحويل الدفعة")');
  await page.waitForTimeout(200);
  const statusInvalid = await page.locator('#bulkStatus').textContent();
  const matAfterInvalid = await page.evaluate(() =>
    window.__calls.filter((c) => c.op === 'materialize').length,
  );
  const matBefore = calls1.length;
  pass(
    'UI_S06_invalid_price_blocks',
    /غير صالح|قيم غير صالحة/.test(statusInvalid || '') && matAfterInvalid === matBefore,
    { statusInvalid, matAfterInvalid, matBefore },
  );

  // Upload resume: seed verifying session in sessionStorage path via API mock + media job
  await page.evaluate(() => {
    const id = 'm-resume';
    MiraBulkAdd._mediaJobs[id] = {
      clientMediaId: id,
      batchId: 'batchA',
      cardId: 'c001',
      fileName: 'x.jpg',
      mimeType: 'image/jpeg',
      size: 10,
      status: 'needs_reconcile',
      sessionId: 'sess-verify',
      ownerId: 'own-x',
      ownerKindPath: 'products',
      file: null,
      needsLocalFile: true,
    };
    window.__sessions['sess-verify'] = {
      sessionId: 'sess-verify',
      status: 'verifying',
      ownerKind: 'product',
      ownerId: 'own-x',
      declaredChecksum: 'chk',
      declaredByteSize: 10,
    };
  });
  // Fix invalid price so upload can proceed path
  await vPrice.fill('45');
  await page.click('button:has-text("رفع/استكمال وسائط")');
  await page.waitForTimeout(400);
  const resumeState = await page.evaluate(() => {
    const j = MiraBulkAdd._mediaJobs['m-resume'];
    return j && { status: j.status, needsLocalFile: j.needsLocalFile, error: j.error };
  });
  pass(
    'UI_S07_verify_no_file_demand',
    resumeState && resumeState.status === 'verifying' && resumeState.needsLocalFile === false,
    resumeState,
  );

  // uploaded → verifying without needs_file
  await page.evaluate(() => {
    window.__sessions['sess-up'] = {
      sessionId: 'sess-up',
      status: 'uploaded',
      ownerKind: 'product',
      ownerId: 'own-x',
      storageCompleted: true,
      declaredByteSize: 10,
    };
    MiraBulkAdd._mediaJobs['m-up'] = {
      clientMediaId: 'm-up',
      batchId: 'batchA',
      cardId: 'c001',
      fileName: 'y.jpg',
      status: 'needs_reconcile',
      sessionId: 'sess-up',
      ownerKindPath: 'products',
      ownerId: 'own-x',
      file: null,
      needsLocalFile: true,
    };
  });
  await page.click('button:has-text("رفع/استكمال وسائط")');
  await page.waitForTimeout(400);
  const upState = await page.evaluate(() => {
    const j = MiraBulkAdd._mediaJobs['m-up'];
    return j && { status: j.status, needsLocalFile: j.needsLocalFile };
  });
  pass('UI_S08_uploaded_is_verifying', upState && upState.status === 'verifying' && !upState.needsLocalFile, upState);

  await shot('final');
} catch (e) {
  pass('UI_HARNESS_ERROR', false, { error: String(e && e.stack ? e.stack : e) });
  await shot('error');
}

await browser.close();
server.close();
const payload = {
  id: 'P6_BULK_PORTAL_UI_ACCEPTANCE',
  started,
  finished: new Date().toISOString(),
  cwd: process.cwd(),
  exitCode: results.every((r) => r.pass) ? 0 : 1,
  results,
};
writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload));
process.exit(payload.exitCode);
