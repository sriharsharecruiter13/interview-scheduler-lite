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
    // element type is string → lrange returns string[]
    const raw = await redis.lrange<string>(KEYS.subs, 0, -1);
    return (raw || []).map((s) => JSON.parse(s)) as EaSubmission[];
  }
  return localSubs;
}
// === Exec availability history log ===
// This is used by /api/execs so schedulers can see past availability
// across multiple requests, not just the current window.

import { Redis as ExecHistoryRedisClient } from '@upstash/redis';

const execHistoryRedis = ExecHistoryRedisClient.fromEnv();

export type ExecHistoryRange = { start: string; end: string };

export type ExecHistoryEntry = {
  execName: string;
  ranges: ExecHistoryRange[];
  at: string; // when this availability was submitted
  // If later you want to attach candidate info, you can add:
  // candidateName?: string;
  // title?: string;
};

const EXEC_HISTORY_KEY = 'exec_history_v1';

export async function addExecHistoryEntry(entry: ExecHistoryEntry) {
  await execHistoryRedis.lpush(EXEC_HISTORY_KEY, JSON.stringify(entry));
  // keep only the latest 1000 entries to avoid unbounded growth
  await execHistoryRedis.ltrim(EXEC_HISTORY_KEY, 0, 999);
}

export async function getExecHistoryEntries(): Promise<ExecHistoryEntry[]> {
  const raw = await execHistoryRedis.lrange(EXEC_HISTORY_KEY, 0, -1);

  const entries: ExecHistoryEntry[] = [];
  for (const item of raw) {
    try {
      entries.push(JSON.parse(item as string));
    } catch {
      // ignore malformed rows
    }
  }

  return entries;
}

