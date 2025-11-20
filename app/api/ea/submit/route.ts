import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db'; // 3-level relative from app/api/ea/submit/route.ts

type EaRange = { start: string; end: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=> ({}));
    const execName = String(body?.execName || '').trim();
    const ranges = Array.isArray(body?.ranges) ? body.ranges as EaRange[] : [];

    // Basic validation — these are the usual reasons EA page "throws an error"
    const clean = ranges
      .filter(r => r?.start && r?.end)
      .map(r => ({ start: String(r.start), end: String(r.end) }))
      .filter(r => new Date(r.end) > new Date(r.start));

    if (!execName || clean.length === 0) {
      return NextResponse.json(
        { ok:false, error:'Enter Exec name and at least one valid time range.' },
        { status:400 }
      );
    }

    db.submissions.push({ execName, ranges: clean, at: new Date().toISOString() });
    return NextResponse.json({ ok:true });
  } catch {
    return NextResponse.json({ ok:false, error:'Bad request' }, { status:400 });
  }
}

export async function GET() {
  return NextResponse.json({ submissions: db.submissions });
}
