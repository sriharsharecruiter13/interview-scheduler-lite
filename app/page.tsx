'use client';
import { useState } from 'react';

type Range = { start:string; end:string };
type EAContact = { email:string; execName:string };

export default function Scheduler(){
  const [candidateName,setCandidateName]=useState('');
  const [title,setTitle]=useState('');
  const [candidateRanges,setCandidateRanges]=useState<Range[]>([{start:'',end:''}]);
  const [eaDirectory,setEaDirectory]=useState<EAContact[]>([{email:'',execName:''}]);

  const [link,setLink]=useState('');
  const [dash,setDash]=useState('');      // <-- define setDash here
  const [msg,setMsg]=useState(''); const [err,setErr]=useState('');

  function setCR(i:number,k:'start'|'end',v:string){
    setCandidateRanges(list=>list.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  }
  function addCR(){ setCandidateRanges(list=>[...list,{start:'',end:''}]); }
  function rmCR(i:number){ setCandidateRanges(list=>list.filter((_,idx)=>idx!==i)); }

  function setEA(i:number,k:'email'|'execName',v:string){
    setEaDirectory(list=>list.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  }
  function addEA(){ setEaDirectory(list=>[...list,{email:'',execName:''}]); }
  function rmEA(i:number){ setEaDirectory(list=>list.filter((_,idx)=>idx!==i)); }

  async function submit(){
    setMsg(''); setErr(''); setLink(''); setDash('');
    try{
      const cleanRanges = candidateRanges.filter(r=>r.start && r.end);
      const cleanEAs = eaDirectory.filter(e=>e.email && e.execName);
      if (!candidateName || !title || cleanRanges.length===0) throw new Error('Fill candidate, title, and at least one candidate range.');
      const r = await fetch('/api/window',{ method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ candidateName, title, candidateRanges: cleanRanges, eaDirectory: cleanEAs })
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || 'Failed');
      setLink(d.eaLink);
      setDash(d.dashboard);   // <-- now setDash is defined and used
      setMsg('Request created. Share the links below.');
    }catch(e:any){ setErr(e.message||'Failed'); }
  }

  return (
    <div style={{maxWidth:960,margin:'20px auto',padding:'16px'}}>
      <nav style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <a href="/" className="link">Scheduler</a>
        <a href="/respond" className="link">EA page</a>
        <a href="/dashboard" className="link">Dashboard</a>
      </nav>

      <h1 style={{fontSize:22,fontWeight:800,marginBottom:8}}>Interview Scheduler</h1>

      <label>Candidate name</label>
      <input className="input" value={candidateName} onChange={e=>setCandidateName(e.target.value)} />

      <label style={{marginTop:8}}>Title</label>
      <input className="input" value={title} onChange={e=>setTitle(e.target.value)} />

      <label style={{marginTop:8}}>Candidate availability (15-min increments)</label>
      {candidateRanges.map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginTop:6}}>
          <input className="input" type="datetime-local" step="900" value={r.start} onChange={e=>setCR(i,'start',e.target.value)} />
          <input className="input" type="datetime-local" step="900" value={r.end} onChange={e=>setCR(i,'end',e.target.value)} />
          <button className="btn" onClick={()=>rmCR(i)}>Remove</button>
        </div>
      ))}
      <button className="btn" onClick={addCR} style={{marginTop:6}}>Add another range</button>

      <div className="card" style={{marginTop:12}}>
        <b>EA directory</b>
        {eaDirectory.map((e,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginTop:6}}>
            <input className="input" placeholder="Exec name" value={e.execName} onChange={ev=>setEA(i,'execName',ev.target.value)} />
            <input className="input" placeholder="EA email" value={e.email} onChange={ev=>setEA(i,'email',ev.target.value)} />
            <button className="btn" onClick={()=>rmEA(i)}>Remove</button>
          </div>
        ))}
        <button className="btn" onClick={addEA} style={{marginTop:6}}>Add exec + EA</button>
      </div>

      <button className="submit" onClick={submit} style={{marginTop:12}}>Create request</button>

      {(link || dash) && (
        <div className="card" style={{marginTop:12}}>
          {link && <div>EA page: <a href={link} target="_blank" rel="noreferrer">{link}</a></div>}
          {dash && <div>Dashboard: <a href={dash} target="_blank" rel="noreferrer">{dash}</a></div>}
        </div>
      )}

      {msg && <div className="ok" style={{marginTop:12}}>{msg}</div>}
      {err && <div className="err" style={{marginTop:12}}>{err}</div>}

      <style jsx>{`
        .link{padding:6px 10px;border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;color:#1e3a8a;background:#eff6ff}
        label{display:block;font-weight:600;margin:6px 0;}
        .input{width:100%;border:1px solid #dbeafe;padding:10px;border-radius:10px;}
        .btn{border:1px solid #dbeafe;background:#fff;padding:8px 12px;border-radius:10px;}
        .submit{background:#2563eb;color:#fff;font-weight:700;padding:10px 16px;border-radius:10px;}
        .card{border:1px solid #dbeafe;border-radius:12px;padding:10px;background:#fff}
        .ok{background:#ecfdf5;color:#065f46;padding:10px;border-radius:10px;}
        .err{background:#fef2f2;color:#991b1b;padding:10px;border-radius:10px;}
      `}</style>
    </div>
  );
}
