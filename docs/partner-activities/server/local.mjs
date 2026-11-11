import http from 'node:http';import {randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';import {localHost} from './local-host.mjs';import {identityKinds,modes,PolicyError} from './model.mjs';
const port=Number(process.env.PORT??4317),origin='http://127.0.0.1:'+port;
const admin=process.env.MIRA_LOCAL_ADMIN_PASSWORD??randomBytes(18).toString('base64url'),developer=process.env.MIRA_LOCAL_DEV_PASSWORD??randomBytes(18).toString('base64url');
const h=await localHost(process.env.MIRA_LOCAL_DB??'./local-test.sqlite',{admin,developer}),sessions=new Map();
const routes={'/':'index.html','/apply.html':'index.html','/profile':'index.html','/review':'index.html','/status':'index.html','/ui.js':'ui.js','/style.css':'style.css'};
function auth(req){let c=/\bpa_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie??'');const s=c&&sessions.get(c[1]);return s&&s.until>Date.now()?s.id:null}
function die(status,code){throw new PolicyError(status,code)}
http.createServer(async(req,res)=>{
 const reply=(s,v)=>{res.writeHead(s,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v))};
 try{const url=new URL(req.url,origin); if(req.headers.host!==new URL(origin).host)die(400,'INVALID_HOST');const path=url.pathname;
 if(req.method==='GET'&&Object.hasOwn(routes,path)){const f=routes[path];res.writeHead(200,{'content-type':(f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'text/css')+'; charset=utf-8','content-security-policy':"default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"});res.end(await readFile(new URL('../web/'+f,import.meta.url)));return}
 if(!path.startsWith('/api/'))die(404,'NOT_FOUND');let data={};
 if(req.method==='POST'){if(req.headers.origin&&req.headers.origin!==origin)die(403,'ORIGIN');if(req.headers['content-type']?.split(';')[0]!=='application/json')die(415,'JSON_REQUIRED');
  let body='',total=0;for await(const chunk of req){total+=chunk.length;if(total>65536)die(413,'TOO_LARGE');body+=chunk.toString('binary')}try{data=JSON.parse(Buffer.from(body,'binary').toString('utf8'))}catch{die(400,'INVALID_JSON')}}
 const route=req.method+' '+path,a=await h.principal(auth(req));
 if(route==='GET /api/catalog')return reply(200,{items:await h.policy.catalog(),identityKinds,modes});
 if(route==='POST /api/apply')return reply(201,await h.policy.apply(data.contact,data.request));
 if(route==='POST /api/status')return reply(200,await h.status(data.email,data.password));
 if(route==='POST /api/login'){const key=await h.login(data.email,data.password),token=randomBytes(32).toString('base64url');sessions.set(token,{id:key,until:Date.now()+8*3600000});
  res.setHeader('set-cookie','pa_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800');return reply(200,{ok:true})}
 if(route==='POST /api/logout'){const token=/\bpa_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie??'');if(token)sessions.delete(token[1]);res.setHeader('set-cookie','pa_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return reply(200,{ok:true})}
 if(route==='GET /api/me')return reply(200,{actor:a,profile:a?.role==='partner'?await h.policy.profile(a):null});
 if(route==='POST /api/expand')return reply(201,await h.policy.expand(a,data));
 if(route==='GET /api/review')return reply(200,await h.queue(a));
 if(route==='POST /api/decide')return reply(200,await h.policy.decide(a,data.requestId,data.decision));
 if(route==='GET /api/items')return reply(200,await h.items(a));
 if(route==='POST /api/item')return reply(200,await h.saveItem(a,data));
 die(404,'NOT_FOUND')
 }catch(e){reply(e instanceof PolicyError?e.status:500,{error:e instanceof PolicyError?e.code:'INTERNAL'})}
}).listen(port,'127.0.0.1',()=>{console.log(origin+' — LOCAL only'); if(!process.env.MIRA_LOCAL_ADMIN_PASSWORD)console.log('Temporary local admin@local.test:',admin);if(!process.env.MIRA_LOCAL_DEV_PASSWORD)console.log('Temporary local developer@local.test:',developer)});
