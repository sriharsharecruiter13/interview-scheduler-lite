import { NextResponse } from 'next/server';
import { makeId } from '../../../../lib/db';
import { saveWindow, addSubmission } from '../../../../lib/store';

function iso(y:number,m:number,d:number,h:number,min:number){
  // Local time → ISO
  const t = new Date(y, m-1, d, h, min);
  return t.toISOString();
}

export const runtime = 'nodejs';

export async function POST() {
  // Candidate window: Nov 21, 10:00–17:00
  const window = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    candidateName: 'Pat Taylor',
    title: 'Director, Product',
    candidateRanges: [
      { start: iso(2025,11,21,10,0), end: iso(2025,11,21,17,0) }
    ],
    eaDirectory: [
      { execName:'Cathy', email:'cathy@example.com' },
      { execName:'Neil',  email:'neil@example.com'  },
      { execName:'John',  email:'john@example.com'  }
    ]
  };
  await saveWindow(window as any);

  // Three execs with overlap (so dashboard shows common 60-mins)
  await addSubmission({
    execName:'Cathy',
    ranges:[
      { start: iso(2025,11,21,11,0), end: iso(2025,11,21,13,30) },
      { start: iso(2025,11,21,15,0), end: iso(2025,11,21,16,0) },
    ],
    at:new Date().toISOString()
  } as any);

  await addSubmission({
    execName:'Neil',
    ranges:[
      { start: iso(2025,11,21,12,0), end: iso(2025,11,21,17,0) },
    ],
    at:new Date().toISOString()
  } as any);

  await addSubmission({
    execName:'John',
    ranges:[
      { start: iso(2025,11,21,13,0), end: iso(2025,11,21,16,0) },
    ],
    at:new Date().toISOString()
  } as any);

  return NextResponse.json({ ok:true, seeded:true });
}
