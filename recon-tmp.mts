import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local','utf8').split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^"|"$/g,'');}
const { kv } = await import('@vercel/kv');
// reconcile cron log — is it running?
const log = await kv.zrange('reconcile_log', -8, -1, { withScores: true }) as (string|number)[];
console.log('=== recent reconcile runs ===');
for(let i=0;i<log.length;i+=2){ try{const e=JSON.parse(String(log[i])); console.log(new Date(Number(log[i+1])).toISOString(), 'scanned',e.scanned,'orphans',e.orphans,'credited',e.credited,'skipped',e.skipped);}catch{console.log(String(log[i]));} }
// recent purchase tx records — rail + status
let cursor='0'; const txKeys:string[]=[];
do{const r=await kv.scan(cursor,{match:'tx:*:processed',count:1000}) as [string,string[]];cursor=String(r[0]);txKeys.push(...(r[1]||[]));}while(cursor!=='0');
console.log('\n=== processed purchase tx records:', txKeys.length, '===');
const rail:Record<string,number>={}; let recent=0; const now=Date.now();
for(const k of txKeys){const t=await kv.get(k) as any; const tt=typeof t==='string'?JSON.parse(t):t; if(!tt)continue; const r=tt.paymentRail||'?'; rail[r]=(rail[r]||0)+1; if(tt.timestamp&&now-tt.timestamp<86400000*3)recent++;}
console.log('rail distribution (all processed):', JSON.stringify(rail));
console.log('processed in last 3 days:', recent);
// pending_admin_credit (logged failures needing manual credit)
let c2='0'; const pend:string[]=[];
do{const r=await kv.scan(c2,{match:'tx:*',count:1000}) as [string,string[]];c2=String(r[0]);pend.push(...(r[1]||[]).filter(k=>!k.endsWith(':processed')));}while(c2!=='0');
console.log('\nnon-processed tx:* keys (pending/failed):', pend.length);
let pendCount=0;
for(const k of pend.slice(0,200)){const t=await kv.get(k) as any;const tt=typeof t==='string'?JSON.parse(t):t; if(tt?.status==='pending_admin_credit'){pendCount++; if(pendCount<=8)console.log('  PENDING', tt.paymentRail, tt.username, tt.txHash, new Date(tt.timestamp||0).toISOString());}}
console.log('pending_admin_credit total (sampled):', pendCount);
