import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({}));
    const to = Array.isArray(body?.to) ? body.to : (body?.to ? [body.to] : []);
    const subject = body?.subject || '';
    const html = body?.html || '';

    // If a key is configured, try to use Resend (loaded dynamically)
    if (process.env.RESEND_API_KEY) {
      const mod: any = await import('resend').catch(()=>null);
      if (mod?.Resend) {
        const resend = new mod.Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'Scheduler <no-reply@example.com>',
          to,
          subject,
          html
        });
        return NextResponse.json({ ok:true, sent:true });
      }
    }

    // Fallback: don’t fail the app if email infra isn’t ready
    console.log('[email stub] Would send →', { to, subject });
    return NextResponse.json({ ok:true, sent:false, stub:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || 'send failed' }, { status:500 });
  }
}
