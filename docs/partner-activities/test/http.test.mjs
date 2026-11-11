import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:net';import {once} from 'node:events';
test('HTTP: public join → pending → admin approval → sign in → save → expansion → publish; direct writes cannot grant another activity',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'pa-http-'));const sock=createServer();sock.listen(0,'127.0.0.1');await once(sock,'listening');const port=sock.address().port;await new Promise(ok=>sock.close(ok));
 const app=spawn(process.execPath,['server/local.mjs'],{env:{...process.env,PORT:String(port),MIRA_LOCAL_DB:join(dir,'test.sqlite'),MIRA_LOCAL_ADMIN_PASSWORD:'admin-test-only',MIRA_LOCAL_DEV_PASSWORD:'dev-test-only'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(app.exitCode===null){const ended=once(app,'exit');app.kill();await ended}await rm(dir,{recursive:true,force:true})});
 await new Promise((ok,bad)=>{const timeout=setTimeout(()=>bad(Error('startup timeout')),6000);app.stdout.once('data',()=>{clearTimeout(timeout);ok()});app.once('exit',()=>{clearTimeout(timeout);bad(Error('server exited'))})});
 const base='http://127.0.0.1:'+port;async function api(path,body,cookie){const headers={'content-type':'application/json',origin:base};if(cookie)headers.cookie=cookie;const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});return [r.status,await r.json(),r.headers.get('set-cookie')?.split(';')[0]]}
 const contact={name:'متجر قبول',contactName:'المسؤولة',email:'partner@example.test',phone:'0500000000',city:'الرياض',evidence:'',password:'partner-test-only'};
 const req=act=>({identity:['shop'],locations:[],description:'الموافقة على نشاط محدد',lines:[{activity:act,scope:'category'}]});
 assert.equal((await fetch(base+'/apply.html')).status,200);assert.equal((await api('review'))[0],403);
 assert.equal((await api('apply',{contact:{...contact,role:'developer'},request:req('clothes.evening')}))[0],400);
 const [,r]=await api('apply',{contact,request:req('clothes.evening')});assert.ok(r.requestId);
 const pass={email:contact.email,password:contact.password};assert.equal((await api('status',pass))[1].state,'pending');assert.equal((await api('login',pass))[0],403);
 const [, ,ad]=await api('login',{email:'admin@local.test',password:'admin-test-only'});
 const [,q]=await api('review',null,ad);assert.equal(q[0].business.name,contact.name);
 const approve=(row)=>api('decide',{requestId:row.id,decision:{verificationNote:'مطابقة بيانات الاختبار',approvedLineIds:row.lines.map(l=>l.id)}},ad);
 assert.equal((await approve(q[0]))[1].state,'approved');const [,,pc]=await api('login',pass);
 const add=(activity,publish=false)=>api('item',{kind:'product',activity,title:'عنصر قبول',publish},pc);
 assert.equal((await add('clothes.evening'))[0],200);assert.equal((await add('bags.hand',true))[0],403);
 assert.equal((await api('expand',req('bags.hand'),pc))[0],201);assert.equal((await add('bags.hand'))[0],403);
 const [,q2]=await api('review',null,ad);await approve(q2[0]);assert.equal((await add('bags.hand',true))[1].state,'published');
 assert.equal((await api('items',null,pc))[1].length,2);const [,me]=await api('me',null,pc);assert.equal(me.profile.grants.length,2);
 await api('logout',{},pc);assert.equal((await api('items',null,pc))[0],403);
});
