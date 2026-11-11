import {randomUUID} from 'node:crypto';
export class PolicyError extends Error {constructor(status,code){super(code);this.code=code;this.status=status}}
const fail=(s,c)=>{throw new PolicyError(s,c)};
const id=()=>randomUUID(), now=()=>new Date().toISOString();
const str=(v,n=200)=>typeof v==='string' && v.trim().length>0 && v.trim().length<=n;
const normalize=s=>s.normalize('NFKC').trim().replace(/\s+/gu,' ');
const ownKeys=(obj,keys)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))fail(400,'INVALID_FIELDS')};
export const identityKinds={shop:'متجر متعدد العلامات',brand:'علامة تجارية',salon:'صالون نسائي',independent:'مقدمة خدمة مستقلة',clinic:'عيادة',events:'جهة تنظيم مناسبات'};
export const modes={venue:'في مقر المنشأة',client_home:'في منزل العميلة',provider_home:'في استوديو أو مقر مقدمة الخدمة',remote:'عن بُعد'};
function codes(x,allowed,required=false){if(!Array.isArray(x)||x.length>Object.keys(allowed).length||(required&&!x.length)||new Set(x).size!==x.length||x.some(k=>!Object.hasOwn(allowed,k)))fail(400,'INVALID_OPTIONS');return x}
function validate(data,catalog){
 ownKeys(data,['identity','locations','description','lines']);
 const identity=codes(data.identity,identityKinds,true),locations=codes(data.locations,modes);
 if(!str(data.description,800)||!Array.isArray(data.lines)||!data.lines.length||data.lines.length>150)fail(400,'INVALID_APPLICATION');
 const seen=new Set(),lines=data.lines.map(v=>{
  ownKeys(v,['activity','scope','itemName']);const def=catalog.get(v.activity);
  if(!def||def.selectable!==true||!['category','one'].includes(v.scope))fail(400,'UNKNOWN_ACTIVITY');
  if(v.scope==='one'&&(def.kind!=='product'||!str(v.itemName,120)))fail(400,'INVALID_SINGLE_ITEM');
  if(v.scope==='category'&&v.itemName!=null&&v.itemName!=='')fail(400,'INVALID_SCOPE');
  const it=v.scope==='one'?normalize(v.itemName):'';const key=JSON.stringify([v.activity,v.scope,it]);
  if(seen.has(key))fail(400,'DUPLICATE_LINE');seen.add(key);
  return {activity:v.activity,scope:v.scope,item_name:it};
 });
 if(lines.some(v=>catalog.get(v.activity).kind==='service')&&!locations.length)fail(400,'SERVICE_LOCATION_REQUIRED');
 if(lines.some(a=>a.scope==='one'&&lines.some(b=>b.activity===a.activity&&b.scope==='category')))fail(400,'OVERLAPPING_SCOPE');
 return {identity,locations,description:normalize(data.description),lines};
}
function member(a){if(a?.role!=='partner'||a.active!==true||!str(a.partnerId)||!str(a.id))fail(403,'ACTIVE_PARTNER_REQUIRED')}
function admin(a){if(a?.role!=='admin'||a.active!==true||!str(a.id))fail(403,'REVIEWER_REQUIRED')}
async function log(t,r,a,op,detail){await t.run('INSERT INTO pa_history(id,request_id,actor,action,happened_at,detail) VALUES(?,?,?,?,?,?)',id(),r,a,op,now(),JSON.stringify(detail))}
export function makePolicy({db,loadCatalog,createPendingApplication,reviewHostApplication}){
 async function request(t,d,kind,pid,aid,actor){
  const rid=id();await t.run('INSERT INTO pa_requests(id,application_id,partner_id,kind,state,description,meta,submitted_at) VALUES(?,?,?,?,?,?,?,?)',rid,aid,pid,kind,'pending',d.description,JSON.stringify({identity:d.identity,locations:d.locations}),now());
  for(const l of d.lines)await t.run('INSERT INTO pa_lines(id,request_id,activity,scope,item_name,decision) VALUES(?,?,?,?,?,?)',id(),rid,l.activity,l.scope,l.item_name,'pending');
  await log(t,rid,actor,'submitted',{kind,count:d.lines.length});return {requestId:rid,state:'pending'};
 }
 async function details(t,r){return {...r,meta:JSON.parse(r.meta),lines:await t.all('SELECT id,activity,scope,item_name,decision FROM pa_lines WHERE request_id=? ORDER BY activity,item_name',r.id)}}
 return {
  async catalog(){return [...(await loadCatalog()).values()].filter(v=>v.selectable===true)},
  // Host owns contact verification/password setup and provisioning; never accept applicationId/partnerId from a public form.
  async apply(contact,data){ownKeys(contact,['name','nameEn','contactName','email','phone','city','password','evidence','commercialRegistration','vatNumber']);const cat=await loadCatalog();const d=validate(data,cat);return db.tx(async t=>{const aid=await createPendingApplication(t,contact,{identity:d.identity,locations:d.locations});if(!str(aid))throw Error('host application missing');return request(t,d,'join',null,aid,'applicant')})},
  async expand(actor,data){member(actor);const cat=await loadCatalog(),d=validate(data,cat);return db.tx(async t=>{
   if(await t.one("SELECT id FROM pa_requests WHERE partner_id=? AND kind='expand' AND state='pending'",actor.partnerId))fail(409,'EXPANSION_PENDING');
   for(const l of d.lines)if(await t.one("SELECT line_id FROM pa_grants WHERE partner_id=? AND activity=? AND (scope='category' OR (scope=? AND item_name=?))",actor.partnerId,l.activity,l.scope,l.item_name))fail(409,'ALREADY_GRANTED');
   return request(t,d,'expand',actor.partnerId,null,actor.id)})},
  async profile(actor){member(actor);return db.tx(async t=>{const requests=[];for(const r of await t.all('SELECT * FROM pa_requests WHERE partner_id=? ORDER BY submitted_at DESC',actor.partnerId))requests.push(await details(t,r));return {grants:await t.all('SELECT activity,scope,item_name FROM pa_grants WHERE partner_id=? ORDER BY activity,item_name',actor.partnerId),requests}})},
  async queue(actor){admin(actor);return db.tx(async t=>{const arr=[];for(const r of await t.all("SELECT * FROM pa_requests WHERE state='pending' ORDER BY submitted_at"))arr.push(await details(t,r));return arr})},
  async decide(actor,rid,payload){admin(actor);ownKeys(payload,['approvedLineIds','reason','verificationNote']);
   const ids=payload.approvedLineIds;if(!Array.isArray(ids)||ids.some(k=>!str(k))||new Set(ids).size!==ids.length)fail(400,'INVALID_DECISION');
   if(payload.reason!=null&&(typeof payload.reason!=='string'||payload.reason.length>800))fail(400,'INVALID_REASON');
   const cat=await loadCatalog();return db.tx(async t=>{const r=await t.one('SELECT * FROM pa_requests WHERE id=?',rid);
    if(!r)fail(404,'NOT_FOUND');if(r.state!=='pending')fail(409,'ALREADY_REVIEWED');
    const lines=await t.all('SELECT * FROM pa_lines WHERE request_id=?',rid);
    if(ids.some(k=>!lines.some(l=>l.id===k)))fail(400,'LINE_OUTSIDE_REQUEST');
    if(lines.some(l=>ids.includes(l.id)&&cat.get(l.activity)?.selectable!==true))fail(409,'INACTIVE_ACTIVITY');
    if(ids.length<lines.length&&!str(payload.reason,800))fail(400,'REASON_REQUIRED');
    if(ids.length&&!str(payload.verificationNote,500))fail(400,'VERIFICATION_REQUIRED');
    const state=ids.length===0?'rejected':ids.length===lines.length?'approved':'partial';
    let pid=r.partner_id;
    if(r.kind==='join')pid=await reviewHostApplication(t,r.application_id,state,actor.id,{reason:payload.reason??'',meta:JSON.parse(r.meta),approved:lines.filter(l=>ids.includes(l.id))});
    if(ids.length&&!str(pid))throw Error('host did not return verified partner id');
    const result=await t.run("UPDATE pa_requests SET state=?,partner_id=?,reviewer_id=?,reviewed_at=?,reason=? WHERE id=? AND state='pending'",state,pid??null,actor.id,now(),payload.reason?.trim()??'',rid);
    if((result.rowCount??result.changes)!==1)fail(409,'ALREADY_REVIEWED');
    for(const l of lines){const yes=ids.includes(l.id);
     await t.run('UPDATE pa_lines SET decision=? WHERE id=?',yes?'approved':'rejected',l.id);
     if(yes)await t.run('INSERT INTO pa_grants(partner_id,activity,scope,item_name,line_id) VALUES(?,?,?,?,?) ON CONFLICT(partner_id,activity,scope,item_name) DO NOTHING',pid,l.activity,l.scope,l.item_name,l.id);
    }
    await log(t,rid,actor.id,'decision',{state,approved:ids,verificationNote:ids.length?payload.verificationNote.trim():'',reason:payload.reason||''});return {state,partnerId:pid??null};
   })},
  // assert + actual write are one transaction. trusted item = resolved ownership, canonical taxonomy and stable lineage from server.
  async authorizedWrite(actor,resolveInTx,writeInTx){
   if(actor?.role!=='developer')member(actor);else if(actor.active!==true||!str(actor.id))fail(403,'INACTIVE_ACCOUNT');
   const cat=await loadCatalog();return db.tx(async t=>{
    const target=await resolveInTx(t),def=cat.get(target?.activity);
    if(!def||def.kind!==target.kind||!str(target.partnerId)||!str(target.lineageId)||!str(target.title,200))fail(400,'INVALID_TARGET');
    if(actor.role==='developer')return writeInTx(t,target); // Trusted developer retains all valid product/service types including jewelry.
    if(target.partnerId!==actor.partnerId)fail(403,'NOT_OWNER');
    if(def.selectable!==true)fail(403,'INACTIVE_ACTIVITY');
    const g=await t.one("SELECT line_id FROM pa_grants WHERE partner_id=? AND activity=? AND scope='category'",actor.partnerId,target.activity);
    if(!g){
     const s=await t.one("SELECT * FROM pa_grants WHERE partner_id=? AND activity=? AND scope='one' AND item_name=?",actor.partnerId,target.activity,normalize(target.title));
     if(!s||(s.bound_item&&s.bound_item!==target.lineageId))fail(403,'ACTIVITY_NOT_APPROVED');
     const b=await t.run('UPDATE pa_grants SET bound_item=? WHERE line_id=? AND (bound_item IS NULL OR bound_item=?)',target.lineageId,s.line_id,target.lineageId);
     if((b.rowCount??b.changes)!==1)fail(403,'ITEM_ALREADY_BOUND');
    }
    return writeInTx(t,target);
   });
  }
 };
}
