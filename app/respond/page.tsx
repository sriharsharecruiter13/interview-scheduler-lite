'use client';
import { useEffect, useMemo, useState } from 'react';

type Range = { start:string; end:string };
type Submission = { execName:string; ranges:Range[]; at:string };

function humanRangeLocal(sISO:string,eISO:string){
  const s=new Date(sISO), e=new Date(eISO);
  const dFmt=new Intl.DateTimeFormat(undefined,{ day:'2-digit', month:'short' });
  const tFmt=new Intl.DateTimeFormat(undefined,{ hour:'numeric', minute:'2-digit' });
  return `${dFmt.format(s)} ${tFmt.format(s)} – ${tFmt.format(e)}`;
}
function dayKey(iso:string){
  return new Date(iso).toLocaleDateString(undefined,{ day:'2-digit', month:'short' });
}

export default function Respond(){
  const [execName,setExecName]=useState('');
  const [rows,setRows]=useState<Range[]>([{start:'',end:''}]);
  const [candidateRanges,setCandidateRanges]=useState<Range[]>([]);
  const [subs,setSubs]=useState<Submission[]>([]);
  const [done,setDone]=useState(''); const [err,setErr]=useState('');
  const [analysis,setAnalysis]=useState<any>(null);

  async function load(){
    const r=await fetch(`/api/window`); const d=await r.json();
    setCandidateRanges(d?.window?.candidateRanges||[]);
    setSubs((d?.submissions||[]));
  }
  async function loadAnalysis(){
    const r=await fetch('/api/agent/run'); const j=await r.json().catch(()=>null);
    if (j?.ok || j?.analysis) setAnalysis(j.analysis || j);
  }

  useEffect(()=>{ load(); loadAnalysis(); },[]);
  useEffect(()=>{
    const t=setInterval(()=>{ load(); loadAnalysis(); }, 10000);
    return ()=>clearInterval(t);
  },[]);

  function setRow(i:number,k:'start'|'end',v:string){
    setRows(list=>list.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  }
  function addRow(){ setRows(list=>[...list,{start:'',end:''}]); }
  function removeRow(i:number){ setRows(list=>list.filter((_,idx)=>idx!==i)); }

  async function submit(){
    setErr(''); setDone('');
    try{
      const clean = rows
        .filter(r=>r.start && r.end)
        .filter(r=> new Date(r.end) > new Date(r.start))
        .map(r=>({ start:r.start, end:r.end }));
      if (!execName) throw new Error('Enter Exec name.');
      if (clean.length===0) throw new Error('Add at least one valid time range.');
      const res=await fetch('/api/ea/submit',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ execName, ranges:clean })});
      if(!res.ok){ const j=await res.json().catch(()=>null); throw new Error(j?.error || 'Failed to save'); }
      setDone('Saved. Your previous availability (if any) was replaced.');
      setRows([{start:'',end:''}]);
      load(); loadAnalysis();
    }catch(e:any){ setErr(e.message||'Failed'); }
  }
  async function removeMine(){
    setErr(''); setDone('');
    try{
      if (!execName) throw new Error('Enter Exec name to remove it.');
      const res=await fetch('/api/ea/submit',{ method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ execName })});
      if(!res.ok) throw new Error('Failed to remove');
      setDone('Removed your availability.');
      load(); loadAnalysis();
    }catch(e:any){ setErr(e.message||'Failed'); }
  }

  // group exec availability by day (for the table)
  const grouped=useMemo(()=>{
    const map:Record<string,Record<string,string[]>>={};
    for(const s of subs){
      for(const r of s.ranges||[]){
        const day=dayKey(r.start);
        map[day] ||= {};
        map[day][s.execName] ||= [];
        const tf=(x:string)=> new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(x));
        map[day][s.execName].push(`${tf(r.start)}–${tf(r.end)}`);
      }
    }
    return map;
  },[subs]);
  const execColumns = Array.from(new Set(subs.map(s=>s.execName)));

  return (
    <div style={{maxWidth:960,margin:'20px auto',padding:'16px'}}>
      <nav style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <a href="/" className="link">Scheduler</a>
        <a href="/respond" className="link">EA page</a>
        <a href="/dashboard" className="link">Dashboard</a>
      </nav>

      <h1 style={{fontSize:22,fontWeight:800,marginBottom:8}}>EA availability submission</h1>

      {candidateRanges.length>0 && (
        <div className="card" style={{marginBottom:12}}>
          <b>Candidate availability:</b>
          <ul style={{margin:'6px 0 0 16px'}}>
            {candidateRanges.map((r,i)=><li key={i}>{humanRangeLocal(r.start,r.end)}</li>)}
          </ul>
        </div>
      )}

      {/* Moved: Exec availability table RIGHT UNDER candidate availability */}
      {execColumns.length>0 && Object.keys(grouped).length>0 && (
        <div className="card" style={{marginBottom:12}}>
          <b>Exec availability so far (grouped by day)</b>
          <div className="tableWrap">
            <table className="avail">
              <thead>
                <tr>
                  <th>Date</th>
                  {execColumns.map(name=><th key={name}>{name}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([day,row])=>(
                  <tr key={day}>
                    <td className="day">{day}</td>
                    {execColumns.map(name=><td key={name}>{(row as any)[name]?.join(', ')||'—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Common windows (60-min) with quorum ≥ 2 */}
      {analysis?.sixty?.filter((w:any)=> (w.execs||[]).length>=2).length>0 && (
        <div className="card" style={{marginBottom:12, background:'#f8fafc'}}>
          <b>Common 60-min windows (most execs first)</b>
          <ul style={{margin:'6px 0 0 16px'}}>
            {analysis.sixty
              .filter((w:any)=> (w.execs||[]).length>=2)
              .slice(0,5)
              .map((w:any,i:number)=>(
                <li key={i}>
                  {humanRangeLocal(w.start,w.end)} — <span style={{color:'#0b2a8a'}}>{w.execs.join(', ')}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <label>Exec name</label>
      <input className="input" value={execName} onChange={e=>setExecName(e.target.value)} />

      <label style={{marginTop:10}}>Add exec time ranges (15-min steps)</label>
      {rows.map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginTop:8}}>
          <input className="input" type="datetime-local" step="900" value={r.start} onChange={e=>setRow(i,'start',e.target.value)} />
          <input className="input" type="datetime-local" step="900" value={r.end} onChange={e=>setRow(i,'end',e.target.value)} />
          <button className="btn" onClick={()=>removeRow(i)}>Remove</button>
        </div>
      ))}
      <button className="btn" onClick={addRow} style={{marginTop:8}}>Add another range</button>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button className="submit" onClick={submit} disabled={!execName}>Save / Replace my availability</button>
        <button className="btn" onClick={removeMine}>Remove my availability</button>
      </div>

      {done && <div className="ok" style={{marginTop:12}}>{done}</div>}
      {err && <div className="err" style={{marginTop:12}}>{err}</div>}

      <style jsx>{`
        .card{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;}
        .tableWrap{overflow-x:auto;margin-top:8px}
        table.avail{width:100%;border-collapse:collapse;font-size:14px}
        th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}
        th{background:#f9fafb}
        .day{font-weight:600;white-space:nowrap}
        label{display:block;font-weight:600;margin:6px 0;}
        .input{width:100%;border:1px solid #d1d5db;padding:10px;border-radius:10px;}
        .btn{border:1px solid #d1d5db;background:#fff;padding:8px 12px;border-radius:10px;}
        .submit{background:#2563eb;color:#fff;font-weight:700;padding:10px 16px;border-radius:10px;}
        .ok{background:#ecfdf5;color:#065f46;padding:10px;border-radius:10px;}
        .err{background:#fef2f2;color:#991b1b;padding:10px;border-radius:10px;}
        .link{padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;color:#111;background:#fff}
      `}</style>
    </div>
  );
}
