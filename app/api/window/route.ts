import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db, makeId } from '../../../lib/db';

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}));
  const { candidateName = '', title = '', candidateRanges = [], eaDirectory = [] } = body;

  db.window = {
    candidateName,
    title,
    candidateRanges,
    eaDirectory,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
  db.submissions = [];

  // Build absolute URLs from the incoming request host (works on localhost & Vercel)
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`.replace(/\/+$/,'');

  return NextResponse.json({
    ok: true,
    eaLink: `${base}/respond`,
    dashboard: `${base}/dashboard`
  });
}

export async function GET() {
  return NextResponse.json({ window: db.window, submissions: db.submissions });
}
