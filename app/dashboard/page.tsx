'use client';
import { useEffect,useMemo,useState } from 'react';

type Range={start:string;end:string};
type Submission={execName:string;ranges?:Range[];at:string};
type EAContact={email:string;execName:string};
type WindowData={candidateName:string;title:string;candidateRanges:Range[];eaDirectory?:EAContact[]};

const MS15=15*60*1000,MS60=60*60*1000,MS30=30*60*1000;
const t=(s:string)=>new Date(s).getTime();
const iso=(ms:number)=>new Date(ms).toISOString();
const dayKey=(d:Date)=> new Intl.DateTimeFormat(undefined,{month:'short',day:'2-digit'}).format(d);
const timeFmt=(d:Date)=> new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(d);
function humanRangeLocal(s:string,e:string){
  const S=new Date(s),E=new Date(e);
  const d=new Intl.DateTimeFormat(undefined,{day:'2-digit',month:'short'});
  const tm=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
  return `${d.format(S)} ${tm.format(S)} – ${tm.format(E)}`;
}

function merge(r:Range[]){ if(!r?.length) return []; const A=r.slice().sort((a,b)=>t(a.start)-t(b.start)); const out:[Range]=[{...A[0]}];
  for(let i=1;i<A.length;i++){ const p=out[out.length-1], c=A[i]; if(t(c.start)<=t(p.end)){ if(t(c.end)>t(p.end)) p.end=c.end; } else out.push({...c}); }
  return out;
}
function intersect(a:Range,b:Range){ const s=Math.max(t(a.start),t(b.start)), e=Math.min(t(a.end),t(b.end)); return e>s?{start:iso(s),end:iso(e)}:null; }
function interMany(a:Range[],b:Range[]){ const o:Range[]=[]; for(const ra of a){ for(const rb of b){ const x=intersect(ra,rb); if(x) o.push(x); } } return merge(o); }
function buildCoverage(c:Range[],execs:Submission[]){
  const C=merge(c);
  const per:Record<string,Range[]>= {};
  for(const s of execs){ per[s.execName]=interMany(C,merge(s.ranges||[])); }
  const ticks:number[]=[];
  for(const r of C){ let ms=Math.ceil(t(r.start)/MS15)*MS15, end=Math.floor(t(r.end)/MS15)*MS15; for(;ms<end;ms+=MS15) ticks.push(ms); }
  const cover=ticks.map(ms=>{
    const active=execs.filter(e=>(per[e.execName]||[]).some(r=>t(r.start)<=ms && ms+MS15<=t(r.end))).map(e=>e.execName);
    return {ms,active};
  });
  const wins:{start:number;end:number;active:string[]}[]=[];
  for(const pt of cover){
    if(!wins.length || JSON.stringify(pt.active)!==JSON.stringify(wins[wins.length-1].active)) wins.push({start:pt.ms,end:pt.ms+MS15,active:pt.active});
    else wins[wins.length-1].end=pt.ms+MS15;
  }
  return wins.filter(w=>w.end-w.start>=MS15).map(w=>({start:iso(w.start),end:iso(w.end),active:w.active,count:w.active.length}));
}

export default function Dashboard(){
  const[win,setWin]=useState<WindowData|null>(null);
  const[subs,setSubs]=useState<Submission[]>([]);

  useEffect(()=>{ (async()=>{
    const r=await fetch('/api/window'); const d=await r.json();
    setWin(d.window||null); setSubs(d.submissions||[]);
  })(); },[]);

  const {best,alts,flex,perDayRows} = useMemo(()=>{
    if(!win) return {best:null,alts:[],flex:[],perDayRows:[] as {day:string,rows:{exec:string,slots:string[]}[]}[]};

    // Build majority + alternates (60 min, quorum >= 2)
    const execs = subs.filter(s=>Array.isArray(s.ranges)&&s.ranges.length>0);
    const windows = buildCoverage(win.candidateRanges||[], execs);
    const sixty = windows.filter(w=> (t(w.end)-t(w.start))>=MS60 && w.count>=2);
    let best:any=null, alts:any[]=[];
    if (sixty.length){
      const max = Math.max(...sixty.map(w=>w.count));
      best = sixty.filter(w=>w.count===max).sort((a,b)=>a.start.localeCompare(b.start))[0];
      alts = sixty.filter(w=>w.count<max).sort((a,b)=> b.count-a.count || a.start.localeCompare(b.start)).slice(0,2);
    }

    // FLEX: compare against full directory (not just those who submitted)
    const allExecs = new Set((win.eaDirectory||[]).map(e=>e.execName));
    const activeSet = new Set(best?.active || []);
    const flexList = best ? Array.from(allExecs).filter(x=>!activeSet.has(x)) : [];

    // Exec availability by day (execs as rows)
    // For each exec, intersect their ranges with candidate ranges, then group by day.
    const cand = merge(win.candidateRanges||[]);
    const byExec:Record<string,Range[]> = {};
    for(const s of subs){
      const merged = merge(s.ranges||[]);
      byExec[s.execName] = interMany(cand, merged); // only show within candidate window
    }
    // Include execs who haven't submitted (empty)
    for(const e of (win.eaDirectory||[])) if (!(e.execName in byExec)) byExec[e.execName] = [];

    // Build day -> exec -> slots text[]
    const dayMap:Record<string,{exec:string,slots:string[]}[]> = {};
    for(const [execName, ranges] of Object.entries(byExec)){
      // split each range by day boundaries
      const slotsByDay:Record<string,string[]> = {};
      for(const r of ranges){
        let s = new Date(r.start), e = new Date(r.end);
        let cur = new Date(s);
        while (cur <= e){
          const day = dayKey(cur);
          // segment within this day
          const dayStart = new Date(cur); dayStart.setHours(0,0,0,0);
          const dayEnd = new Date(dayStart); dayEnd.setHours(23,59,59,999);
          const segStart = new Date(Math.max(cur.getTime(), s.getTime()));
          const segEnd = new Date(Math.min(dayEnd.getTime(), e.getTime()));
          if (segEnd > segStart){
            (slotsByDay[day] ||= []).push(`${timeFmt(segStart)} – ${timeFmt(segEnd)}`);
          }
          // move to next day
          cur = new Date(dayEnd.getTime()+1);
        }
      }
      // push rows for days that exist (and also days from candidate window so table shows columns consistently)
      const candDays = new Set<string>();
      for (const r of cand){ let cur=new Date(r.start); const end=new Date(r.end); 
        while (cur<=end){ candDays.add(dayKey(cur)); const nd=new Date(cur); nd.setDate(nd.getDate()+1); nd.setHours(0,0,0,0); cur=nd; } }
      const allDays = Array.from(new Set([...Object.keys(slotsByDay), ...Array.from(candDays)])).sort((a,b)=>a.localeCompare(b));
      for(const d of allDays){
        (dayMap[d] ||= []);
        const slots = slotsByDay[d] || [];
        dayMap[d].push({ exec: execName, slots });
      }
    }
    // turn into ordered list of sections with rows = execs
    const perDayRows = Object.entries(dayMap)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([day, rows])=>({
        day,
        rows: rows.sort((a,b)=> a.exec.localeCompare(b.exec))
      }));

    return {best,alts,flex:flexList,perDayRows};
  },[win,subs]);

  return (
    <div className="wrap">
      <nav className="nav">
        <a href="/" className="link">Scheduler</a>
        <a href="/respond" className="link">EA page</a>
        <a href="/dashboard" className="link">Dashboard</a>
      </nav>

      <h1 className="h1">Scheduling Dashboard</h1>

      {win ? (
        <div className="card">
          <div><b>Candidate:</b> {win.candidateName}</div>
          <div><b>Title:</b> {win.title}</div>
          <div className="sub">
            <b>Candidate availability</b>
            <ul>{(win.candidateRanges||[]).map((r,i)=><li key={i}>{humanRangeLocal(r.start,r.end)}</li>)}</ul>
          </div>
        </div>
      ) : <div className="muted">No request yet. Create it on the Scheduler page.</div>}

      {/* Exec availability so far — execs as rows */}
      <div className="card" style={{marginTop:12}}>
        <div className="sectionTitle">Exec availability so far (grouped by day)</div>
        {perDayRows.length===0 ? <div className="muted">No availability yet.</div> : (
          perDayRows.map(section=>(
            <div key={section.day} className="dayBlock">
              <div className="dayHeader">{section.day}</div>
              <table className="table">
                <thead><tr><th>Exec</th><th>Times</th></tr></thead>
                <tbody>
                  {section.rows.map((r,i)=>(
                    <tr key={i}>
                      <td className="exec">{r.exec}</td>
                      <td>{r.slots.length ? r.slots.join(' • ') : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Majority + alternates + flex */}
      <div className="grid">
        <div className="card">
          <div className="sectionTitle">Majority 60-min window</div>
          {best ? (
            <div className="win best">
              <b>{humanRangeLocal(best.start,best.end)}</b>
              <div className="muted">Aligned execs ({best.count}): {best.active.join(', ')}</div>
            </div>
          ) : <div className="muted">No 60-min window with quorum ≥ 2 yet.</div>}

          {alts?.length>0 && (
            <>
              <div className="sectionTitle" style={{marginTop:12}}>Next possible windows</div>
              <ul className="list">
                {alts.map((w:any,i:number)=>(
                  <li key={i} className="win">
                    <b>{humanRangeLocal(w.start,w.end)}</b>
                    <div className="muted">Aligned execs ({w.count}): {w.active.join(', ')}</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="tip" style={{marginTop:12}}>
            <b>Ask to flex:</b> {best ? (flex.length? flex.join(', ') : '—') : '—'}
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap{max-width:1100px;margin:20px auto;padding:16px}
        .nav{display:flex;gap:12px;margin-bottom:16px}
        .link{padding:6px 10px;border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;color:#1e3a8a;background:#eff6ff}
        .h1{font-size:22px;font-weight:800;margin-bottom:8px}
        .card{border:1px solid #dbeafe;border-radius:14px;padding:14px;background:#fff}
        .sub{margin-top:6px}
        .muted{color:#6b7280}
        .grid{margin-top:14px}
        .list{display:flex;flex-direction:column;gap:10px;margin:8px 0 0}
        .win{border:1px solid #bfdbfe;border-radius:12px;padding:10px}
        .best{background:#eff6ff;border-color:#60a5fa}
        .sectionTitle{font-weight:700;margin-bottom:6px;color:#1e3a8a}
        .dayBlock{margin-top:10px}
        .dayHeader{font-weight:700;color:#111;margin-bottom:6px}
        .table{width:100%;border-collapse:separate;border-spacing:0}
        .table thead th{text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 8px}
        .table tbody td{padding:6px 8px;border-bottom:1px solid #f3f4f6}
        .exec{white-space:nowrap;font-weight:600}
        .tip{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px;border-radius:10px}
      `}</style>
    </div>
  );
}
