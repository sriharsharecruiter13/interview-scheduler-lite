import { db } from './db';
type Range = { start:string; end:string };
type Submission = { execName:string; ranges?:Range[]; at:string };
const MS15=15*60*1000, MS60=60*60*1000;
const t=(s:string)=>new Date(s).getTime();
const iso=(ms:number)=>new Date(ms).toISOString();

function mergeRanges(r:Range[]){if(!r?.length)return[];const A=r.slice().sort((x,y)=>t(x.start)-t(y.start));const o:[Range]=[{...A[0]}];for(let i=1;i<A.length;i++){const p=o[o.length-1],c=A[i];if(t(c.start)<=t(p.end)){if(t(c.end)>t(p.end))p.end=c.end;}else o.push({...c});}return o;}
function intersect(a:Range,b:Range){const s=Math.max(t(a.start),t(b.start));const e=Math.min(t(a.end),t(b.end));return e>s?{start:iso(s),end:iso(e)}:null;}
function intersectMany(a:Range[],b:Range[]){const o:Range[]=[];for(const ra of a){for(const rb of b){const x=intersect(ra,rb);if(x)o.push(x);}}return mergeRanges(o);}

export function analyze(){
  if(!db.window)return{ok:false};
  const cand=mergeRanges(db.window.candidateRanges||[]);
  const execs:(Submission[])=(db.submissions||[])as any;
  const perExec:Record<string,Range[]>={};
  for(const s of execs){perExec[s.execName]=intersectMany(cand,mergeRanges(s.ranges||[]));}
  const ticks:number[]=[];for(const r of cand){let ms=Math.ceil(t(r.start)/MS15)*MS15,end=Math.floor(t(r.end)/MS15)*MS15;for(;ms<end;ms+=MS15)ticks.push(ms);}
  const cover=ticks.map(ms=>{const active=execs.filter(e=>(perExec[e.execName]||[]).some(r=>t(r.start)<=ms&&ms+MS15<=t(r.end))).map(e=>e.execName);return{ms,active};});
  const wins:{start:number;end:number;execs:string[]}[]=[];for(const pt of cover){if(!wins.length||JSON.stringify(pt.active)!==JSON.stringify(wins[wins.length-1].execs))wins.push({start:pt.ms,end:pt.ms+MS15,execs:pt.active});else wins[wins.length-1].end=pt.ms+MS15;}
  const merged=wins.filter(w=>w.end-w.start>=MS15).map(w=>({start:iso(w.start),end:iso(w.end),execs:w.execs,count:w.execs.length}));
  const sixty=merged.filter(w=>(t(w.end)-t(w.start))>=MS60);
  const quorum=sixty.filter(w=>w.count>=2);
  const max=quorum.length?Math.max(...quorum.map(w=>w.count)):0;
  const majority=quorum.filter(w=>w.count===max).sort((a,b)=>a.start.localeCompare(b.start));
  const top=majority[0]||null;
  const alternates=quorum.filter(w=>!top||w.start!==top.start||w.end!==top.end).sort((a,b)=>b.count-a.count||a.start.localeCompare(b.start)).slice(0,2);
  const allExecs=new Set((db.window.eaDirectory||[]).map((e:any)=>e.execName));
  const submitted=new Set((db.submissions||[]).map(s=>s.execName));
  const missing=Array.from(allExecs).filter(x=>!submitted.has(x));
  const created=t((db.window as any).createdAt||0), now=Date.now();
  const hours=(now-created)/3600000;
  const shouldRemind=hours>=2&&missing.length>0;
  return{ok:true,majority:top,alternates,flexAsk:top?Array.from(allExecs).filter(x=>!top.execs.includes(x)):[],missing,shouldRemind};
}
