import { Redis } from '@upstash/redis';
import type { Window, EaSubmission } from './db';

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

let localWindow: Window | null = null;
let localSubs: EaSubmission[] = [];

const KEYS = { window: 'isl:window', subs: 'isl:subs' };

export async function saveWindow(win: Window) {
  if (redis) {
    await redis.set(KEYS.window, win);
    await redis.del(KEYS.subs);
  } else {
    localWindow = win;
    localSubs = [];
  }
}

export async function getWindow(): Promise<Window | null> {
  if (redis) return (await redis.get<Window>(KEYS.window)) || null;
  return localWindow;
}

export async function addSubmission(sub: EaSubmission) {
  if (redis) {
    await redis.rpush(KEYS.subs, JSON.stringify(sub));
  } else {
    localSubs.push(sub);
  }
}

export async function getSubmissions(): Promise<EaSubmission[]> {
  if (redis) {
    const raw = await redis.lrange<string[]>(KEYS.subs, 0, -1);
    return (raw || []).map((s) => JSON.parse(s)) as EaSubmission[];
  }
  return localSubs;
}
