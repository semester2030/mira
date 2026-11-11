// LOCAL INTEGRATION HARNESS only. Production must reuse existing auth, approval, and catalog.
import {sqlite} from './db.mjs';import {makePolicy,PolicyError} from './model.mjs';import {fixtureCatalog} from './catalog.fixture.mjs';
import {scryptSync as hash,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
function str(s,n){return typeof s==='string'&&s.trim().length>0&&s.length<=n}
const bad=(s,c)=>{throw new PolicyError(s,c)};
function credential(password){let salt=randomBytes(16).toString('hex');return salt+':'+hash(password,salt,64).toString('hex')}
function matched(p,d){let [salt,key]=d.split(':');return timingSafeEqual(hash(p,salt,64),Buffer.from(key,'hex'))}
export async function localHost(path=':memory:',secrets={}){
 const db=await sqlite(path),cat=fixtureCatalog();
 await db.tx(async t=>{
  await t.run('CREATE TABLE IF NOT EXISTS local_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,display TEXT NOT NULL,hash TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL,partner_id TEXT,contact TEXT NOT NULL)');
  await t.run('CREATE TABLE IF NOT EXISTS local_items(id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, kind TEXT NOT NULL, activity TEXT NOT NULL,title TEXT NOT NULL,state TEXT NOT NULL)');
  for(const role of ['admin','developer'])if(secrets[role])await t.run("INSERT INTO local_accounts VALUES(?,?,?,?,?,1,NULL,'{}') ON CONFLICT(email) DO UPDATE SET hash=excluded.hash WHERE local_accounts.role=excluded.role",role,role+'@local.test',role,credential(secrets[role]),role);
 });
 const policy=makePolicy({db,loadCatalog:()=>cat,
  createPendingApplication:async(t,contact)=>{
   if(!contact||Object.keys(contact).some(k=>!['name','email','phone','city','password','evidence','contactName','nameEn','commercialRegistration','vatNumber'].includes(k)))bad(400,'INVALID_CONTACT');
   const {name,email,phone,city,password,evidence,contactName}=contact;
   if(!str(name,120)||!str(contactName,120)||!str(city,100)||!str(email,254)||!/^\S+@\S+\.\S+$/.test(email)||!str(phone,26)||!/^\+?[0-9 ()-]{8,25}$/.test(phone)||!str(password,128)||password.length<10||typeof evidence!=='string'||evidence.length>500)bad(400,'INVALID_CONTACT');
   if(evidence){let u;try{u=new URL(evidence)}catch{bad(400,'INVALID_CONTACT')}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)bad(400,'INVALID_CONTACT')}
   for(const key of ['nameEn','commercialRegistration','vatNumber'])if(contact[key]!=null&&(typeof contact[key]!=='string'||contact[key].length>140))bad(400,'INVALID_CONTACT');
   const mail=email.trim().toLowerCase();if(await t.one('SELECT id FROM local_accounts WHERE email=?',mail))bad(409,'ACCOUNT_EXISTS');
   const aid=randomUUID();await t.run('INSERT INTO local_accounts VALUES(?,?,?,?,?,0,NULL,?)',aid,mail,name.trim(),credential(password),'partner',JSON.stringify({contactName,city,phone,evidence,nameEn:contact.nameEn??'',commercialRegistration:contact.commercialRegistration??'',vatNumber:contact.vatNumber??''}));return aid;
  },
  reviewHostApplication:async(t,aid,state)=>{const a=await t.one('SELECT id,active,role FROM local_accounts WHERE id=?',aid);if(!a||a.active||a.role!=='partner')bad(409,'HOST_STATE_CHANGED');
   if(state==='rejected')return null;const pid=randomUUID();await t.run('UPDATE local_accounts SET active=1,partner_id=? WHERE id=?',pid,aid);return pid}
 });
 return {db,policy,cat,async login(email,p){if(!str(email,254)||!str(p,128))bad(403,'LOGIN_FAILED');
  const a=await db.tx(t=>t.one('SELECT * FROM local_accounts WHERE email=?',email.trim().toLowerCase()));
  if(!a||!matched(p,a.hash)||!a.active)bad(403,'LOGIN_FAILED');return a.id},
  async status(email,password){
   if(!str(email,254)||!str(password,128))bad(403,'LOGIN_FAILED');
   return db.tx(async t=>{const a=await t.one('SELECT * FROM local_accounts WHERE email=? AND role=?',email.trim().toLowerCase(),'partner');
    if(!a||!matched(password,a.hash))bad(403,'LOGIN_FAILED');const r=await t.one('SELECT id,state,reason FROM pa_requests WHERE application_id=?',a.id);
    if(!r)bad(404,'NOT_FOUND');return {...r,lines:await t.all('SELECT activity,scope,item_name,decision FROM pa_lines WHERE request_id=?',r.id)};});
  },async principal(key){if(!key)return null;const a=await db.tx(t=>t.one('SELECT id,role,active,partner_id,display FROM local_accounts WHERE id=?',key));return a?{id:a.id,role:a.role,active:a.active===1,partnerId:a.partner_id,display:a.display}:null},
  async queue(a){const requests=await policy.queue(a);return db.tx(async t=>{for(const r of requests){
   let owner=r.application_id?await t.one('SELECT display,email,contact FROM local_accounts WHERE id=?',r.application_id):await t.one('SELECT display,email,contact FROM local_accounts WHERE partner_id=?',r.partner_id);
   if(owner)r.business={name:owner.display,email:owner.email,...JSON.parse(owner.contact)}
  }return requests})},
  async items(a){
   if(!a?.active||!['partner','developer'].includes(a.role))bad(403,'ACTIVE_PARTNER_REQUIRED');
   return db.tx(t=>a.role==='developer'?t.all('SELECT * FROM local_items ORDER BY id'):t.all('SELECT * FROM local_items WHERE partner_id=? ORDER BY id',a.partnerId))
  },
  async saveItem(a,{id:oldId,kind,activity,title,publish=false}){
   if(!str(title,120)||!['service','product'].includes(kind)||!str(activity,150)||typeof publish!=='boolean'||(oldId!=null&&!str(oldId,90)))bad(400,'INVALID_TARGET');
   return policy.authorizedWrite(a,async t=>{const old=oldId?await t.one('SELECT * FROM local_items WHERE id=?',oldId):null;
    if(oldId&&!old)bad(404,'NOT_FOUND');if(old&&old.kind!==kind)bad(400,'INVALID_TARGET');return {partnerId:old?.partner_id??(a.role==='developer'?'local-developer':a.partnerId),lineageId:old?.id??randomUUID(),title,kind,activity}},
   async(t,target)=>{await t.run('INSERT INTO local_items VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,activity=excluded.activity,title=excluded.title,state=excluded.state',target.lineageId,target.partnerId,kind,activity,title,publish?'published':'draft');return {id:target.lineageId,state:publish?'published':'draft'}})
  }
 };
}
