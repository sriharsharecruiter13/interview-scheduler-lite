import { NextResponse } from 'next/server';
import { analyze } from '../../../../lib/agent';

function humanRangeLocal(s:string,e:string){
  const S = new Date(s), E = new Date(e);
  const dFmt = new Intl.DateTimeFormat(undefined,{ day:'2-digit', month:'short' });
  const tFmt = new Intl.DateTimeFormat(undefined,{ hour:'numeric', minute:'2-digit' });
  return `${dFmt.format(S)} ${tFmt.format(S)} – ${tFmt.format(E)}`;
}

export async function GET() {
  const a = analyze() as any;
  if (!a?.ok) return NextResponse.json({ ok:false, reason:a?.reason||'no-window' });

  const drafts:any[] = [];
  const winResp = await fetch('http://localhost:3000/api/window').then(r=>r.json()).catch(()=>null);
  const win = winResp?.window || {};

  const candidate = win?.candidateName || '(unknown candidate)';
  const title = win?.title || '(unknown role)';
  const eaLink = `${process.env.APP_BASE_URL?.replace(/\/+$/,'') || 'http://localhost:3000'}/respond`;

  if (a.shouldRemind && a.missing.length){
    const prettyList = a.missing.join(', ');
    const best = a.majority ? `<b>${humanRangeLocal(a.majority.start,a.majority.end)}</b> (${(a.majority.execs||[]).join(', ')})` : '—';
    const altText = a.alternates?.length
      ? a.alternates.map((w:any)=>`${humanRangeLocal(w.start,w.end)} (${(w.execs||[]).join(', ')})`).join('<br/>')
      : 'None';

    drafts.push({
      to: 'USE_EA_DIRECTORY',
      subject: `Reminder: Please share availability for ${candidate} (${title})`,
      html: `
        <p>Hi — just a quick nudge to share your exec's availability for:</p>
        <p><b>Candidate:</b> ${candidate}<br/>
           <b>Title:</b> ${title}</p>
        <p><b>Current best 60-min window:</b><br/>${best}</p>
        <p><b>Other possible windows:</b><br/>${altText}</p>
        <p><b>Executives yet to respond:</b> ${prettyList}</p>
        <p>Please update here: <a href="${eaLink}">${eaLink}</a></p>
        <p>Thanks!<br/>— Scheduler Bot</p>`
    });
  }

  return NextResponse.json({ ok:true, analysis:a, emailDrafts:drafts });
}
