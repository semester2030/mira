// Host adapter: instantiate once, pass its .tx into makePolicy. Do not create a second global Prisma client.
export function prismaDB(client){
 const conv=(s)=>{let i=0;return s.replace(/\?/g,()=>'$'+(++i))};
 return {tx:fn=>client.$transaction(async raw=>fn({
   raw,
   one:async(s,...p)=>(await raw.$queryRawUnsafe(conv(s),...p))[0],
   all:(s,...p)=>raw.$queryRawUnsafe(conv(s),...p),
   run:async(s,...p)=>({rowCount:await raw.$executeRawUnsafe(conv(s),...p)})
 }),{isolationLevel:'Serializable'})};
}
// SQL strings originate only in model.mjs. All user values are separate bind parameters.
