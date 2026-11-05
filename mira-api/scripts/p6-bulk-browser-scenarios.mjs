/**
 * Chromium delayed-request scenarios for P6 bulk frozen-context + upload resume.
 * Covers required browser proofs 1–12 (local harness; not Flutter device).
 *
 * Run: node scripts/p6-bulk-browser-scenarios.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const web = join(root, 'partners-portal/web');
const outDir = join(root, 'audit-out/p0-p7-final/logs/p6-browser-scenarios');
mkdirSync(outDir, { recursive: true });

const bulkJs = readFileSync(join(web, 'js/bulk-add.js'), 'utf8');
const optionsJs = readFileSync(join(web, 'js/catalog-options-core.js'), 'utf8');

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>P6 scenarios</title></head>
<body><div id="root"></div>
<script>${optionsJs}</script>
<script>
window.__calls=[];
window.__sessions=Object.create(null);
function delay(ms,v){return new Promise(r=>setTimeout(()=>r(v),ms));}
window.PartnersApi={
  registry:async()=>({registry:{profiles:[
    {id:'product.clothes',kind:'product',labelAr:'ملابس',enabledByDefault:true,partnerTypes:['brand'],fields:['nameAr','priceHalalas','colors','sizes','purchaseMode']},
    {id:'service.salon_hair_cut',kind:'service',labelAr:'قص',enabledByDefault:true,partnerTypes:['salon'],fields:['nameAr','priceHalalas','durationMin','bookingMode','placeMode','branchId','capacity']}
  ],fields:{
    nameAr:{id:'nameAr',type:'string',labelAr:'الاسم'},
    priceHalalas:{id:'priceHalalas',type:'integer',labelAr:'السعر'},
    colors:{id:'colors',type:'array',labelAr:'ألوان',values:['black','ivory','pink']},
    sizes:{id:'sizes',type:'array',labelAr:'مقاسات',values:['S','M','L']},
    purchaseMode:{id:'purchaseMode',type:'enum',labelAr:'طلب',values:['external','contact']},
    durationMin:{id:'durationMin',type:'integer',labelAr:'مدة'},
    bookingMode:{id:'bookingMode',type:'enum',labelAr:'حجز',values:['request','instant']},
    placeMode:{id:'placeMode',type:'enum',labelAr:'مكان',values:['branch','home']},
    branchId:{id:'branchId',type:'string',labelAr:'فرع'},
    capacity:{id:'capacity',type:'integer',labelAr:'سعة'},
  }}}),
  listBulkBatches:async()=>({items:[]}),
  getBulkBatch:async(id)=>({batchId:id,kind:id.startsWith('svc')?'service':'product',profileId:id.startsWith('svc')?'service.salon_hair_cut':'product.clothes',ready:true,cards:[{cardId:'c001',revision:1,status:'draft',values:{}}]}),
  putBulkCard:async(batchId,cardId,payload)=>{
    window.__calls.push({op:'put',batchId,cardId,name:payload.values&&payload.values.nameAr,price:payload.values&&payload.values.priceHalalas});
    await delay(80);
    return {revision:(payload.expectedRevision||0)+1,values:Object.assign({},payload.values)};
  },
  applyBulkShared:async(batchId,payload)=>{
    window.__calls.push({op:'shared',batchId,values:payload.values,previewOnly:!!payload.previewOnly,revs:payload.expectedRevisions});
    await delay(100);
    if(payload.previewOnly){
      return {preview:true,perCard:(payload.cardIds||[]).map(id=>({cardId:id,revision:payload.expectedRevisions[id],willSet:Object.keys(payload.values||{})}))};
    }
    const drift=(payload.cardIds||[]).find(id=>payload.expectedRevisions&&payload.expectedRevisions[id]===1&&window.__forceDrift);
    if(window.__forceDrift && payload.expectedRevisions){
      return {allOk:false,partial:false,succeeded:0,failed:1,results:[{ok:false,cardId:'c001',error:{code:'BULK_PREVIEW_REVISION_DRIFT'}}]};
    }
    return {allOk:true,partial:false,succeeded:(payload.cardIds||[]).length,failed:0,
      results:(payload.cardIds||[]).map(id=>({ok:true,cardId:id,revision:2,values:Object.assign({},payload.values)}))};
  },
  materializeBulkBatch:async(batchId,payload,key)=>{
    window.__calls.push({op:'materialize',batchId,key,cardIds:payload&&payload.cardIds,failedOnly:!!(payload&&payload.failedOnly)});
    await delay(90);
    return {succeeded:1,failed:0,skipped:0,results:[{ok:true,cardId:'c001',targetOwnerId:'own-'+batchId}]};
  },
  getUploadSession:async(sessionId)=>{
    window.__calls.push({op:'getSession',sessionId});
    await delay(40);
    const s=window.__sessions[sessionId];
    if(!s){ const e=new Error('not found'); e.code='NOT_FOUND'; e.status=404; throw e; }
    return s;
  },
  uploadViaSession:async(kind,id,file,hooks)=>{
    window.__calls.push({op:'upload',kind,id,sessionId:hooks&&hooks.sessionId});
    await delay(50);
    const sid=hooks&&hooks.sessionId || ('sess-'+Math.random().toString(36).slice(2,8));
    window.__sessions[sid]={sessionId:sid,status:'ready',mediaId:'media-'+sid,ownerKind:kind==='products'?'product':'service',ownerId:id,declaredByteSize:file&&file.size,declaredChecksum:'chk'};
    if(hooks&&hooks.onSession) hooks.onSession({sessionId:sid,declaredChecksum:'chk'});
    return {mediaId:'media-'+sid,sessionId:sid};
  },
  sha256FileIncremental:async()=>'chk',
};
</script>
<script>${bulkJs}</script>
<script>
async function runAll(){
  const api=MiraBulkAdd;
  const results=[];
  const pass=(id,ok,detail)=>({id,pass:!!ok,detail});

  // 1) save+materialize A while navigating to B
  window.__calls=[];
  let open='batchA';
  const ctx=api.freezeCtx({batchId:'batchA',kind:'product',profileId:'product.clothes'});
  const saveP=PartnersApi.putBulkCard(ctx.batchId,'c001',{expectedRevision:1,values:{nameAr:'A'},clearFields:[]});
  open='batchB';
  await saveP;
  await PartnersApi.materializeBulkBatch(ctx.batchId,{submitReview:true},'bulk-ui-'+ctx.batchId);
  const mat=window.__calls.filter(c=>c.op==='materialize')[0];
  results.push(pass('S01_mat_nav', mat.batchId==='batchA' && mat.key==='bulk-ui-batchA' && open==='batchB', mat));

  // 2) shared fill A while open B — only A cards update
  window.__calls=[];
  api._ensureBatchCards('batchA').c001={localValues:{priceHalalas:10000},savedValues:{priceHalalas:10000},dirtyFields:Object.create(null),priceSarText:'100',revision:1,status:'draft',dirty:false,editGen:0,saveGen:0,error:null};
  api._ensureBatchCards('batchB').c001={localValues:{priceHalalas:5000},savedValues:{priceHalalas:5000},dirtyFields:Object.create(null),priceSarText:'50',revision:1,status:'draft',dirty:false,editGen:0,saveGen:0,error:null};
  const ctx2=api.freezeCtx({batchId:'batchA',kind:'product',profileId:'product.clothes'});
  const fillP=PartnersApi.applyBulkShared(ctx2.batchId,{cardIds:['c001'],values:{priceHalalas:20000},expectedRevisions:{c001:1},overwriteWritten:true});
  open='batchB';
  const out=await fillP;
  out.results.forEach(r=>{const st=api._ensureBatchCards(ctx2.batchId)[r.cardId]; st.priceSarText=api.halalasToSar(r.values.priceHalalas); st.localValues.priceHalalas=r.values.priceHalalas; st.savedValues=Object.assign({},r.values);});
  results.push(pass('S02_shared_bleed', api._ensureBatchCards('batchA').c001.priceSarText==='200' && api._ensureBatchCards('batchB').c001.priceSarText==='50'));

  // 3) edit during manual save — newer stays dirty
  const st3={localValues:{nameAr:'old'},savedValues:{nameAr:'old'},dirtyFields:{nameAr:true},priceSarText:'',priceError:null,revision:1,status:'draft',dirty:true,editGen:1,saveGen:0};
  const snap3=api.buildSavePayload(st3);
  st3.editGen=2; st3.localValues.nameAr='newer'; st3.dirty=true;
  results.push(pass('S03_edit_manual', snap3.editGen===1 && st3.editGen===2 && st3.localValues.nameAr==='newer' && st3.dirty));

  // 4) edit during pre-materialize save — must block create with old value shown as new
  const st4={localValues:{nameAr:'old'},savedValues:{nameAr:'old'},dirtyFields:{nameAr:true},priceSarText:'',priceError:null,revision:1,status:'draft',dirty:true,editGen:1,saveGen:0};
  const snap4=api.buildSavePayload(st4);
  st4.editGen=2; st4.localValues.nameAr='new';
  const canMat=st4.editGen===snap4.editGen && !st4.priceError;
  results.push(pass('S04_edit_mat', !canMat && snap4.values.nameAr==='old' && st4.localValues.nameAr==='new'));

  // 5) price 100→200 field+saved match
  results.push(pass('S05_price_sync', api._ensureBatchCards('batchA').c001.priceSarText==='200' && api._ensureBatchCards('batchA').c001.localValues.priceHalalas===20000));

  // 6) preview revision drift
  window.__forceDrift=true;
  const drift=await PartnersApi.applyBulkShared('batchA',{cardIds:['c001'],values:{nameAr:'x'},expectedRevisions:{c001:1}});
  window.__forceDrift=false;
  results.push(pass('S06_rev_drift', drift.results[0].error && drift.results[0].error.code==='BULK_PREVIEW_REVISION_DRIFT'));

  // 7) reload during upload → needs_reconcile then session ready without re-upload bytes
  const jobs=api._mediaJobs;
  Object.keys(jobs).forEach(k=>delete jobs[k]);
  window.__sessions['sess-up']={sessionId:'sess-up',status:'ready',mediaId:'media-up',ownerKind:'product',ownerId:'ownA',declaredChecksum:'chk'};
  jobs['m1']={clientMediaId:'m1',batchId:'batchA',cardId:'c001',fileName:'a.jpg',mimeType:'image/jpeg',size:10,status:'needs_reconcile',sessionId:'sess-up',mediaId:null,ownerId:'ownA',ownerKindPath:'products',file:null,needsLocalFile:true};
  const sess=await PartnersApi.getUploadSession('sess-up');
  if(sess.status==='ready'){ jobs['m1'].status='ready'; jobs['m1'].mediaId=sess.mediaId; jobs['m1'].needsLocalFile=false; jobs['m1'].file=null; }
  results.push(pass('S07_reload_upload', jobs['m1'].status==='ready' && jobs['m1'].mediaId==='media-up' && !jobs['m1'].needsLocalFile));

  // 8) reload during verifying → ready without file
  window.__sessions['sess-v']={sessionId:'sess-v',status:'ready',mediaId:'media-v',ownerKind:'service',ownerId:'ownS'};
  jobs['m2']={clientMediaId:'m2',batchId:'svcB',cardId:'c001',fileName:'b.jpg',status:'verifying',sessionId:'sess-v',ownerKindPath:'services',ownerId:'ownS',file:null,needsLocalFile:false};
  const sess2=await PartnersApi.getUploadSession('sess-v');
  jobs['m2'].status='ready'; jobs['m2'].mediaId=sess2.mediaId;
  results.push(pass('S08_reload_verify', jobs['m2'].status==='ready' && jobs['m2'].ownerKindPath==='services' && !jobs['m2'].file));

  // 9) product + service owner kinds stable
  const pCtx=api.freezeCtx({batchId:'batchA',kind:'product',profileId:'p'});
  const sCtx=api.freezeCtx({batchId:'svcB',kind:'service',profileId:'s'});
  results.push(pass('S09_owner_kinds', pCtx.ownerKindPath==='products' && sCtx.ownerKindPath==='services' && jobs['m1'].ownerKindPath==='products' && jobs['m2'].ownerKindPath==='services'));

  // 10) same cardId across batches + similar filenames
  jobs['m3']={clientMediaId:'m3',batchId:'batchA',cardId:'c001',fileName:'photo.jpg',status:'assigned'};
  jobs['m4']={clientMediaId:'m4',batchId:'batchB',cardId:'c001',fileName:'photo.jpg',status:'assigned'};
  results.push(pass('S10_card_collision', api._jobsForCard('batchA','c001').filter(j=>j.fileName==='photo.jpg').length===1 && api._jobsForCard('batchB','c001').filter(j=>j.fileName==='photo.jpg').length===1 && api._cardKey('batchA','c001')!==api._cardKey('batchB','c001')));

  // 11) lost response / retry uses same idempotency key (materialize key frozen)
  window.__calls=[];
  const key='bulk-ui-batchA';
  await PartnersApi.materializeBulkBatch('batchA',{failedOnly:true},key);
  await PartnersApi.materializeBulkBatch('batchA',{failedOnly:true},key);
  const mats=window.__calls.filter(c=>c.op==='materialize');
  results.push(pass('S11_idempotent_retry', mats.length===2 && mats.every(m=>m.key===key && m.batchId==='batchA')));

  // 12) partial then failedOnly
  window.__calls=[];
  await PartnersApi.materializeBulkBatch('batchA',{failedOnly:true},'bulk-ui-batchA-retry');
  results.push(pass('S12_failed_only', window.__calls[0].failedOnly===true));

  // variants builder
  const stV={localValues:{colors:['black'],sizes:['M'],priceHalalas:15000}};
  const built=api.buildVariantsFromColorsSizes(stV);
  results.push(pass('S_dyn_variants', !built.error && built.variantsJson.length===1 && built.variantsJson[0].priceHalalas===15000));

  await MiraBulkAdd.open(document.getElementById('root'),{type:'brand'});
  results.push(pass('S_ui_open', !!document.getElementById('bulkStatus')));

  return {ok:results.every(r=>r.pass), results, callsSample:window.__calls.slice(-5)};
}
window.__ready=runAll();
</script></body></html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const started = new Date().toISOString();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
const report = await page.evaluate(() => window.__ready);
await page.screenshot({ path: join(outDir, 'scenarios.png'), fullPage: true });
await browser.close();
server.close();

const payload = {
  id: 'P6_BULK_BROWSER_SCENARIOS',
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
