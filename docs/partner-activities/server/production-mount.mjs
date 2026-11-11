// Adapter for MIRA's Nest app using its Express HTTP adapter. Mount behind existing host controls.
// Every hook is mandatory, so an unconfigured runtime cannot silently use local identities or a static catalog.
import {makePolicy,identityKinds,modes,PolicyError} from './model.mjs';
import {prismaDB} from './prisma.mjs';
export function createProductionPolicy(host){
 for(const k of ['partnerTaxonomy','submitApplication','reviewApplication','principal','assertPostAllowed','listReviewHeaders','resolveTarget','commitCatalogWrite','listOwnItems'])if(typeof host[k]!=='function')throw Error('Missing MIRA adapter: '+k);
 if(!host.prisma)throw Error('Missing MIRA Prisma client');
 const db=prismaDB(host.prisma);
 return makePolicy({db,loadCatalog:()=>host.partnerTaxonomy(),
   createPendingApplication:(t,body,meta)=>host.submitApplication(t.raw,body,meta),
   reviewHostApplication:(t,id,state,actorId,details)=>host.reviewApplication(t.raw,{applicationId:id,state,allow:state!=='rejected',actorId,...details})});
}
export function catalogMutationGuard(host,policy,actor,command){
 // command is an already validated DTO. The host resolves prior row and final (merged) category, kind,
 // owner and draft→published lineage inside this transaction; it MUST NOT take owner or developer flag from a DTO.
 return policy.authorizedWrite(actor,t=>host.resolveTarget(t.raw,actor,command),(t,effective)=>host.commitCatalogWrite(t.raw,actor,command,effective));
}
export function mountActivities(router,host){
 const policy=createProductionPolicy(host);
 const route=(verb,path,f)=>router[verb](path,async(req,res,next)=>{try{
  if(verb==='post')await host.assertPostAllowed(req);
  const actor=await host.principal(req);res.set('Cache-Control','no-store');res.json(await f(actor,req));
 }catch(err){if(err instanceof PolicyError)return res.status(err.status).json({error:err.code});return next(err)}});
 route('get','/catalog',async()=>({items:await policy.catalog(),identityKinds,modes}));
 route('post','/apply',(_,r)=>policy.apply(r.body.contact,r.body.request));
 route('get','/me',async a=>({actor:a?{role:a.role,display:a.display}:null,profile:a?.role==='partner'?await policy.profile(a):null}));
 route('post','/expand',(a,r)=>policy.expand(a,r.body));
 route('get','/review',async a=>{const rows=await policy.queue(a);return host.listReviewHeaders(a,rows)});
 route('post','/decide',(a,r)=>policy.decide(a,r.body.requestId,r.body.decision));
 route('get','/items',(a)=>{if(!a?.active||!['partner','developer'].includes(a.role))throw new PolicyError(403,'ACTIVE_ACCOUNT_REQUIRED');return host.listOwnItems(a)});
 // Existing portal's login/logout and full editors remain authoritative. Bind *all* existing writes to the same guard.
 return {policy,write:(actor,command)=>catalogMutationGuard(host,policy,actor,command)};
}
