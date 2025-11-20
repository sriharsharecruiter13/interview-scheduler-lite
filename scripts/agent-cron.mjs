import fetch from 'node-fetch';
import { Cron } from 'croner';   // fixed export for Node 18+

const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/,'');

async function runOnce(){
  try {
    const r = await fetch(`${base}/api/agent/run`);
    const j = await r.json().catch(()=>null);
    if (!j?.ok) {
      console.log('No scheduling window or agent not ready');
      return;
    }

    const drafts = j.emailDrafts || [];
    if (drafts.length === 0) {
      console.log('No reminders to send right now');
      return;
    }

    for (const d of drafts){
      const w = await fetch(`${base}/api/window`).then(r=>r.json());
      const dir = w?.window?.eaDirectory || [];
      const to = d.to === 'USE_EA_DIRECTORY'
        ? dir.map(x=>x.email).filter(Boolean)
        : d.to;
      if (!to || to.length === 0) continue;

      await fetch(`${base}/api/email/send`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ to, subject: d.subject, html: d.html })
      }).catch(()=>{});
      console.log('✅ Reminder sent to:', to.join(', '));
    }
  } catch (err) {
    console.error('⚠️ Error running agent cron:', err);
  }
}

// Every 2 hours, between 9am–7pm, Monday–Friday (local time)
new Cron('0 */2 9-19 * * 1-5', runOnce);

console.log('✅ Agent cron is running (every 2h, 9–19 Mon–Fri)');
await runOnce();
