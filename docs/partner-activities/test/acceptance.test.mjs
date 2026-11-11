import test from 'node:test';import assert from 'node:assert/strict';import {localHost} from '../server/local-host.mjs';
const ruler={id:'admin1',role:'admin',active:true},dev={id:'dev1',role:'developer',active:true};
const full=(activity)=>({activity,scope:'category'}),one=(activity,itemName)=>({activity,scope:'one',itemName});
const req=(lines,extras={})=>({identity:['shop'],locations:[],description:'نشاط موثق للمراجعة',lines,...extras});
const person={email:'shop@example.test',name:'متجر ميرا',password:'demoOnlypass1234',phone:'0500000000',contactName:'المسؤولة',city:'الرياض',evidence:'https://example.test/store'};
async function boot(t){const h=await localHost();t.after(()=>h.db.close());return h}
async function reviewed(h,request,contact=person,chosen=null){
 const r=await h.policy.apply(contact,request);const record=(await h.queue(ruler)).find(i=>i.id===r.requestId);assert.ok(record);
 const lineIds=record.lines.filter(l=>!chosen||chosen.includes(l.activity)).map(l=>l.id);
 const decision=await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:lineIds,reason:'تمت مراجعة بيانات النشاط'});
 const uid=await h.login(contact.email,contact.password);return {actor:await h.principal(uid),decision}
}
const item=(activity,title='عرض اختبار',kind='product',more={})=>({activity,title,kind,...more});
async function denied(fn,code){await assert.rejects(fn,e=>e.code===code)}
test('applicant selects multiple types/activities, cannot log in when pending; admin sees identity, evidence, categories; partial decision creates only selected grants',async t=>{
 const h=await boot(t);const r=await h.policy.apply(person,req([full('clothes.evening'),full('bags.hand'),full('face.makeup_tools')],{identity:['shop','brand']}));
 await denied(()=>h.login(person.email,person.password),'LOGIN_FAILED');const [a]=await h.queue(ruler);
 assert.equal(a.business.evidence,person.evidence);assert.deepEqual(a.meta.identity,['shop','brand']);assert.equal(a.lines.length,3);
 let yes=a.lines.filter(x=>x.activity!=='bags.hand').map(x=>x.id);const d=await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:yes,reason:'لم يعتمد نشاط الشنط'});
 assert.equal(d.state,'partial');const u=await h.principal(await h.login(person.email,person.password));assert.equal((await h.policy.profile(u)).grants.length,2);
 await h.saveItem(u,item('clothes.evening'));await denied(()=>h.saveItem(u,item('bags.hand')),'ACTIVITY_NOT_APPROVED')
});
test('partner expansion: no early access, pending does not interrupt existing listings, reject then resubmit and approve; historical decisions persist',async t=>{
 const h=await boot(t),{actor:a}=await reviewed(h,req([full('clothes.wedding_dress')]));
 const add=req([full('bags.hand')]);let r=await h.policy.expand(a,add);
 await denied(()=>h.policy.expand(a,add),'EXPANSION_PENDING');await denied(()=>h.saveItem(a,item('bags.hand')),'ACTIVITY_NOT_APPROVED');
 const x=await h.saveItem(a,item('clothes.wedding_dress'));await h.saveItem(a,item('clothes.wedding_dress','محدّث','product',{id:x.id,publish:true}));
 await denied(()=>h.policy.decide(a,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[],reason:'رفض'}),'REVIEWER_REQUIRED');
 await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[],reason:'استكمال البيانات'});await denied(()=>h.saveItem(a,item('bags.hand')),'ACTIVITY_NOT_APPROVED');
 r=await h.policy.expand(a,add);const line=(await h.queue(ruler))[0].lines[0].id;await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[line]});
 assert.ok((await h.saveItem(a,item('bags.hand'))).id);assert.equal((await h.policy.profile(a)).requests.length,3);
 await denied(()=>h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[line]}),'ALREADY_REVIEWED')
});
test('single cream: same name and canonical lineage across draft/update/publish; a second product or duplicate is denied; a different named cream requires an approved expansion',async t=>{
 const h=await boot(t),{actor:a}=await reviewed(h,req([one('hair.styling','كريم تصفيف أ')],{identity:['brand']}));
 await denied(()=>h.saveItem(a,item('hair.shampoo','كريم تصفيف أ')),'ACTIVITY_NOT_APPROVED');
 await denied(()=>h.saveItem(a,item('hair.styling','كريم ب')),'ACTIVITY_NOT_APPROVED');
 const x=await h.saveItem(a,item('hair.styling','كريم تصفيف أ'));await h.saveItem(a,item('hair.styling','كريم تصفيف أ','product',{id:x.id,publish:true}));
 await denied(()=>h.saveItem(a,item('hair.styling','كريم تصفيف أ')),'ACTIVITY_NOT_APPROVED');
 await denied(()=>h.saveItem(a,item('hair.styling','كريم ب','product',{id:x.id})),'ACTIVITY_NOT_APPROVED');
 const r=await h.policy.expand(a,req([one('hair.styling','كريم ب')],{identity:['brand']}));const l=(await h.queue(ruler))[0].lines[0].id;
 await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[l]});await h.saveItem(a,item('hair.styling','كريم ب'));
});
test('complete hair line is an explicit snapshot of selected leaves; supports multiple offers within granted leaf only',async t=>{
 const h=await boot(t),hair=[...h.cat.keys()].filter(x=>x.startsWith('hair.'));
 const {actor:a}=await reviewed(h,req(hair.map(full),{identity:['brand']}));await h.saveItem(a,item('hair.shampoo','شامبو أ'));await h.saveItem(a,item('hair.shampoo','شامبو ب'));
 await denied(()=>h.saveItem(a,item('face.moisturizer')),'ACTIVITY_NOT_APPROVED')
});
test('at-home makeup artist can book makeup only; salon with hair and makeup; mixed business supports both products and services',async t=>{
 const h=await boot(t),act='service.salon_makeup';
 await denied(()=>h.policy.apply(person,req([full(act)],{identity:['independent']})),'SERVICE_LOCATION_REQUIRED');
 const {actor:a}=await reviewed(h,req([full(act)],{identity:['independent'],locations:['client_home']}));
 await h.saveItem(a,item(act,'ميك أب منزلي','service'));await denied(()=>h.saveItem(a,item('service.salon_hair_color','صبغة','service')),'ACTIVITY_NOT_APPROVED');
 await denied(()=>h.saveItem(a,item('face.makeup_face')),'ACTIVITY_NOT_APPROVED');
 const {actor:s}=await reviewed(h,req([full(act),full('service.salon_hair_cut'),full('hair.shampoo')],{identity:['salon','shop'],locations:['venue','provider_home']}),{...person,email:'mixed@example.test'});
 await h.saveItem(s,item('service.salon_hair_cut','قص وتصفيف','service'));await h.saveItem(s,item('hair.shampoo'));
});
test('developer uses any registered product/service including jewelry; developer cannot be requested in registration; reject invented category, client role or foreign owner',async t=>{
 const h=await boot(t);for(const c of h.cat.values())await h.saveItem(dev,item(c.id,c.label,c.kind));
 await denied(()=>h.policy.apply(person,req([full('bags.hand')],{identity:['developer']})),'INVALID_OPTIONS');
 await denied(()=>h.policy.apply(person,req([full('bags.hand')],{role:'developer'})),'INVALID_FIELDS');
 await denied(()=>h.policy.apply(person,req([full('not.valid')])),'UNKNOWN_ACTIVITY');
 const {actor:a}=await reviewed(h,req([full('bags.hand')]));
 const b=await h.saveItem(dev,item('bags.hand'));await denied(()=>h.saveItem(a,item('bags.hand','أ','product',{id:b.id})),'NOT_OWNER');
 await denied(()=>h.saveItem({...a,active:false},item('bags.hand')),'ACTIVE_PARTNER_REQUIRED');
});
test('negative paths: rejected join has no account access, foreign decision lines and missing reason cannot activate a partner',async t=>{
 const h=await boot(t);const r=await h.policy.apply(person,req([full('bags.hand')]));
 await denied(()=>h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:['different-line']}),'LINE_OUTSIDE_REQUEST');
 await denied(()=>h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[]}),'REASON_REQUIRED');
 await h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[],reason:'معلومات غير مكتملة'});await denied(()=>h.login(person.email,person.password),'LOGIN_FAILED');
});
test('concurrent initial approvals grant once; write failure rolls back single-item binding; profile isolation',async t=>{
 const h=await boot(t),r=await h.policy.apply(person,req([one('hair.styling','كريم')]));
 const id=(await h.queue(ruler))[0].lines[0].id;const both=await Promise.allSettled([1,2].map(()=>h.policy.decide(ruler,r.requestId,{verificationNote:'تمت مراجعة ملف النشاط ومطابقة المنتجات',approvedLineIds:[id]})));assert.equal(both.filter(x=>x.status==='fulfilled').length,1);
 const a=await h.principal(await h.login(person.email,person.password));await assert.rejects(()=>h.policy.authorizedWrite(a,()=>({activity:'hair.styling',partnerId:a.partnerId,kind:'product',lineageId:'first',title:'كريم'}),()=>{throw Error('failed item write')}),/failed item write/);
 await h.saveItem(a,item('hair.styling','كريم'));
 const {actor:b}=await reviewed(h,req([full('shoes.flat')]),{...person,email:'b@example.test'});
 assert.deepEqual((await h.policy.profile(b)).grants.map(g=>g.activity),['shoes.flat']);assert.equal((await h.items(b)).length,0);
});

test('initial approval needs recorded verification basis; partial and rejected decisions keep an audit trail',async t=>{
 const h=await boot(t);const r=await h.policy.apply(person,req([full('bags.hand')]));const row=(await h.queue(ruler))[0];
 await denied(()=>h.policy.decide(ruler,r.requestId,{approvedLineIds:[row.lines[0].id]}),'VERIFICATION_REQUIRED');
 await h.policy.decide(ruler,r.requestId,{approvedLineIds:[row.lines[0].id],verificationNote:'مطابقة المتجر والأنشطة بدليل مراجع'});
 const entry=await h.db.tx(t=>t.one("SELECT actor,detail FROM pa_history WHERE request_id=? AND action='decision'",r.requestId));
 assert.equal(entry.actor,ruler.id);assert.equal(JSON.parse(entry.detail).verificationNote,'مطابقة المتجر والأنشطة بدليل مراجع');
});
