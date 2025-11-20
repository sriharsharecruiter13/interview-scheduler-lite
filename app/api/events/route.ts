import { NextResponse } from 'next/server';
import { onEvent } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      function send(ev: string, data: any){
        const payload = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(payload));
      }
      // heartbeat to keep connections alive
      const ping = setInterval(()=> send('ping', Date.now()), 25000);
      const off = onEvent((ch, payload)=> send(ch, payload || {}));

      // initial hello
      send('hello', { ok:true });

      controller.onclose = () => { clearInterval(ping); off(); };
      controller.onerror = () => { clearInterval(ping); off(); };
      controller.cancel = () => { clearInterval(ping); off(); };
    }
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
