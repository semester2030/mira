// Both adapters expose { one, all, run }. Inject the adapter used by your write transaction.
import {readFileSync} from 'node:fs';
export const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
export async function sqlite(path=':memory:'){
 const {DatabaseSync}=await import('node:sqlite'); const db=new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=4000;');db.exec(schema);
 const io={one:(s,...p)=>db.prepare(s).get(...p),all:(s,...p)=>db.prepare(s).all(...p),run:(s,...p)=>db.prepare(s).run(...p)};
 let tail=Promise.resolve();
 return {tx(fn){const task=tail.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(io);db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}});tail=task.catch(()=>{});return task},close:()=>db.close()};
}
// Use a pg Pool in a pg-based host. For a Prisma host implement the same three operations on its interactive tx;
// never activate a Partner in another connection/transaction than the grants.
export function postgres(pool){
 return {async tx(fn){const c=await pool.connect();const query=(s,p)=>{let i=0;return c.query(s.replace(/\?/g,()=>'$'+(++i)),p)};
  const io={one:async(s,...p)=>(await query(s,p)).rows[0],all:async(s,...p)=>(await query(s,p)).rows,run:async(s,...p)=>query(s,p)};
  try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const res=await fn(io);await c.query('COMMIT');return res}
  catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}};
}
