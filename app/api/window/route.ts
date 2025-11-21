import { NextResponse } from 'next/server';
import { db, makeId } from '../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({} as any));
  const { candidateName, title, candidateRanges = [], eaDirectory = [] } = body;

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
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`.replace(/\/+$/,'');

  return NextResponse.json({
    ok: true,
    eaLink: `${base}/respond`,
    dashboard: `${base}/dashboard`,
  });
}

export async function GET() {
  return NextResponse.json({ window: db.window, submissions: db.submissions });
}
