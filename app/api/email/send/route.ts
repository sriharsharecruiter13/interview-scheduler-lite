import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}));
  // Just acknowledge locally; do not actually send email in local mode
  console.log('LOCAL EMAIL STUB:', {
    to: body?.to, subject: body?.subject
  });
  return NextResponse.json({ ok:true, stub:true });
}
