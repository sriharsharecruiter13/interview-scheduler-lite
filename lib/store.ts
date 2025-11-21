import { kv } from '@vercel/kv';
import type { Window, EaSubmission } from './db';

const HAS_KV = !!process.env.KV_URL;

// Local fallback (used in dev if no KV)
let localWindow: Window | null = null;
let localSubs: EaSubmission[] = [];

const KEYS = {
  window: 'isl:window',
  subs:   'isl:subs',
};

export async function saveWindow(win: Window){
  if (HAS_KV){
    await kv.set(KEYS.window, win);
    await kv.del(KEYS.subs);
  } else {
    localWindow = win;
    localSubs = [];
  }
}

export async function getWindow(): Promise<Window|null>{
  if (HAS_KV) return (await kv.get<Window>(KEYS.window)) || null;
  return localWindow;
}

export async function addSubmission(sub: EaSubmission){
  if (HAS_KV){
    await kv.rpush(KEYS.subs, JSON.stringify(sub));
  } else {
    localSubs.push(sub);
  }
}

export async function getSubmissions(): Promise<EaSubmission[]>{
  if (HAS_KV){
    const raw = await kv.lrange(KEYS.subs, 0, -1);
    return (raw as string[]).map(s=>JSON.parse(s)) as EaSubmission[];
  }
  return localSubs;
}
