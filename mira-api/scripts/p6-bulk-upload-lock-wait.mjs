/**
 * Concurrent media uploads must WAIT for materialize locks — never fail with «تحويل جارٍ».
 * Run: node scripts/p6-bulk-upload-lock-wait.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const web = join(root, 'partners-portal/web');
const outDir = join(root, 'audit-out/p0-p7-final/logs/p6-upload-lock-wait');
mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function mkCards(n) {
  return Array.from({ length: n }, (_, i) => {
    const id = 'c' + String(i + 1).padStart(3, '0');
    return {
      cardId: id,
      revision: 1,
      status: 'draft',
      values: { nameAr: 'P' + id, priceHalalas: 10000 },
      targetOwnerId: null,
    };
  });
}

function buildHtml(kind, cards) {
  const profileId = kind === 'service' ? 'service.salon_hair_cut' : 'product.clothes';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>lock</title></head><body>
<button id="openBulk">إضافة مجموعة</button><div id="bulkRoot"></div>
<script src="/js/catalog-options-core.js"></script>
<script>
window.__calls=[]; window.__matDelay=500; window.__sessions=Object.create(null);
window.__batches={batchA:{batchId:'batchA',kind:${JSON.stringify(kind)},profileId:${JSON.stringify(profileId)},ready:true,cards:${JSON.stringify(cards)}}};
function delay(ms){return new Promise(r=>setTimeout(r,ms==null?60:ms));}
window.PartnersApi={
  isLoggedIn:()=>true,clearSession(){},
  registry:async()=>({registry:{profiles:[
    {id:'product.clothes',kind:'product',labelAr:'ملابس',fields:['nameAr','priceHalalas']},
    {id:'service.salon_hair_cut',kind:'service',labelAr:'قص',fields:['nameAr','priceHalalas','durationMin']},
  ],fields:{nameAr:{id:'nameAr',type:'string',labelAr:'الاسم'},priceHalalas:{id:'priceHalalas',type:'integer',labelAr:'السعر'},durationMin:{id:'durationMin',type:'integer',labelAr:'مدة'}}}}),
  listBulkBatches:async()=>({items:[{batchId:'batchA',kind:window.__batches.batchA.kind,cardCount:window.__batches.batchA.cards.length,materializedCount:window.__batches.batchA.cards.filter(c=>c.status==='materialized').length}]}),
  getBulkBatch:async(id)=>{await delay(15);return JSON.parse(JSON.stringify(window.__batches[id]));},
  putBulkCard:async(batchId,cardId,payload)=>{const c=window.__batches[batchId].cards.find(x=>x.cardId===cardId);c.revision=(payload.expectedRevision||c.revision)+1;c.values=Object.assign({},c.values||{},payload.values||{});return {revision:c.revision,values:Object.assign({},c.values)};},
  materializeBulkBatch:async(batchId,payload,key)=>{
    window.__calls.push({op:'materialize',batchId,key,cardIds:payload&&payload.cardIds});
    await delay(window.__matDelay);
    const b=window.__batches[batchId];
    const targets=(payload&&payload.cardIds)||b.cards.map(c=>c.cardId);
    return {succeeded:targets.length,failed:0,skipped:0,results:targets.map(id=>{const c=b.cards.find(x=>x.cardId===id);if(c.status==='materialized'&&c.targetOwnerId)return {ok:true,skipped:true,cardId:id,targetOwnerId:c.targetOwnerId};c.status='materialized';c.targetOwnerId='own-'+batchId+'-'+id;return {ok:true,cardId:id,targetOwnerId:c.targetOwnerId};})};
  },
  getUploadSession:async(sid)=>{const s=window.__sessions[sid];if(!s){const e=new Error('nf');e.code='NOT_FOUND';e.status=404;throw e;}return Object.assign({},s);},
  retryFinalizeUploadSession:async(sid)=>{const s=window.__sessions[sid];if(s){s.status='ready';s.catalogMediaId='media-'+sid;}window.__calls.push({op:'retryFinalize',sid});return Object.assign({},s);},
  uploadViaSession:async(kind,id,file,hooks)=>{window.__calls.push({op:'upload',kind,id});await delay(30);const sid=(hooks&&hooks.sessionId)||('sess-'+Math.random().toString(36).slice(2,8));if(hooks&&hooks.onSession)hooks.onSession({sessionId:sid});if(hooks&&hooks.onProcessing)hooks.onProcessing();window.__sessions[sid]={sessionId:sid,status:'ready',catalogMediaId:'media-'+sid,ownerKind:kind==='products'?'product':'service',ownerId:id};return window.__sessions[sid];},
  sha256FileIncremental:async()=>'chk',
};
</script>
<script src="/js/bulk-add.js"></script>
<script>document.getElementById('openBulk').onclick=()=>MiraBulkAdd.open(document.getElementById('bulkRoot'),{type:'brand'});</script>
</body></html>`;
}

const results = [];
const pass = (id, ok, detail) => results.push({ id, pass: !!ok, detail });

async function runScenario(label, kind, cardCount, filesPerCard, matDelay) {
  const cards = mkCards(cardCount);
  const html = buildHtml(kind, cards);
  const server = createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    const file = join(web, u.pathname.replace(/^\//, ''));
    if (!file.startsWith(web) || !existsSync(file)) {
      res.writeHead(404);
      res.end('nf');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'bin' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', async (d) => {
    try {
      await d.accept();
    } catch (_) {}
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.click('#openBulk');
  await page.waitForSelector('#bulkStatus');
  await page.evaluate((d) => {
    window.__matDelay = d;
  }, matDelay);
  await page.click('button:has-text("batchA")');
  await page.waitForSelector('.bulk-card');
  await page.evaluate(
    ({ n, fpc, kind: k }) => {
      const kindPath = k === 'service' ? 'services' : 'products';
      for (let i = 0; i < n; i++) {
        const cardId = 'c' + String(i + 1).padStart(3, '0');
        const st = MiraBulkAdd._ensureBatchCards('batchA')[cardId];
        if (st) {
          st.localValues = { nameAr: 'P' + cardId, priceHalalas: 10000 };
          st.savedValues = Object.assign({}, st.localValues);
          st.dirty = false;
          st.status = 'draft';
          st.targetOwnerId = null;
        }
        for (let f = 0; f < fpc; f++) {
          const id = 'm-' + cardId + '-' + f;
          const file = new File([new Uint8Array([1, 2, 3, f])], id + '.jpg', { type: 'image/jpeg' });
          MiraBulkAdd._mediaJobs[id] = {
            clientMediaId: id,
            batchId: 'batchA',
            cardId,
            fileName: file.name,
            mimeType: 'image/jpeg',
            size: file.size,
            status: 'assigned',
            ownerKindPath: kindPath,
            ownerId: null,
            file,
            needsLocalFile: false,
          };
        }
      }
    },
    { n: cardCount, fpc: filesPerCard, kind },
  );
  await page.click('button:has-text("رفع/استكمال وسائط")');
  const deadline = Date.now() + Math.min(180000, matDelay * cardCount + 15000);
  while (Date.now() < deadline) {
    const done = await page.evaluate(() => {
      const jobs = Object.values(MiraBulkAdd._mediaJobs).filter((j) => j.batchId === 'batchA');
      if (!jobs.length) return false;
      return jobs.every((j) =>
        ['ready', 'failed', 'failed_permanent', 'aborted', 'verifying', 'failed_retryable'].includes(j.status),
      );
    });
    if (done) break;
    await page.waitForTimeout(200);
  }
  const summary = await page.evaluate(() => {
    const jobs = Object.values(MiraBulkAdd._mediaJobs).filter((j) => j.batchId === 'batchA');
    const byStatus = {};
    jobs.forEach((j) => {
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    });
    const lockFails = jobs.filter((j) => /تحويل جارٍ|قفل التحويل مشغول/.test(String(j.error || '')));
    const owners = {};
    jobs.forEach((j) => {
      if (!owners[j.cardId]) owners[j.cardId] = new Set();
      if (j.ownerId) owners[j.cardId].add(j.ownerId);
    });
    return {
      jobN: jobs.length,
      byStatus,
      lockFailN: lockFails.length,
      ready: jobs.filter((j) => j.status === 'ready').length,
      ownerDup: Object.keys(owners).filter((c) => owners[c].size > 1),
      matN: window.__calls.filter((c) => c.op === 'materialize').length,
      uploadN: window.__calls.filter((c) => c.op === 'upload').length,
      sampleErrors: jobs.filter((j) => j.error).slice(0, 3).map((j) => j.error),
    };
  });
  const expectJobs = cardCount * filesPerCard;
  pass(
    label,
    summary.jobN === expectJobs &&
      summary.lockFailN === 0 &&
      summary.ready === expectJobs &&
      summary.ownerDup.length === 0 &&
      summary.uploadN === expectJobs,
    summary,
  );
  await browser.close();
  server.close();
}

const started = new Date().toISOString();
await runScenario('LOCK_WAIT_2files_1card_product', 'product', 1, 2, 400);
await runScenario('LOCK_WAIT_10cards_1file_product', 'product', 10, 1, 200);
await runScenario('LOCK_WAIT_2files_1card_service', 'service', 1, 2, 400);
await runScenario('LOCK_WAIT_10cards_1file_service', 'service', 10, 1, 200);

const payload = {
  id: 'P6_BULK_UPLOAD_LOCK_WAIT',
  started,
  finished: new Date().toISOString(),
  exitCode: results.every((r) => r.pass) ? 0 : 1,
  results,
};
writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload));
process.exit(payload.exitCode);
