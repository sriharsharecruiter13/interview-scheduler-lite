import { Redis } from '@upstash/redis';
import type { Window, EaSubmission } from './db';

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;

const redis = HAS_UPSTASH
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export type ExecHistoryRange = { start: string; end: string };

export type ExecHistoryEntry = {
  execName: string;
  ranges: ExecHistoryRange[];
  at: string; // when this availability was submitted
  // later we can add candidateName, title, etc.
};

let localWindow: Window | null = null;
let localSubs: EaSubmission[] = [];
let localExecHistory: ExecHistoryEntry[] = [];

const KEYS = {
  window: 'isl:window',
  subs: 'isl:subs',
  execHistory: 'isl:exec_history_v1',
};

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
  if (redis) {
    return (await redis.get<Window>(KEYS.window)) || null;
  }
  return localWindow;
}

/**
 * addSubmission
 *
 * For the *current window*, there should be at most ONE active submission per exec.
 * So this REPLACES any previous submission for the same execName.
 */
export async function addSubmission(sub: EaSubmission) {
  const execName = (sub as any).execName as string | undefined;

  if (!execName) {
    // fallback: just append if execName missing for some reason
    if (redis) {
      await redis.rpush(KEYS.subs, JSON.stringify(sub));
    } else {
      localSubs.push(sub);
    }
    return;
  }

  if (redis) {
    const raw = await redis.lrange<string>(KEYS.subs, 0, -1);
    const existing: EaSubmission[] = (raw || []).map((s) => JSON.parse(s));

    const filtered = existing.filter(
      (s: any) => s.execName !== execName
    );
    filtered.push(sub);

    await redis.del(KEYS.subs);
    if (filtered.length > 0) {
      await redis.rpush(
        KEYS.subs,
        ...filtered.map((s) => JSON.stringify(s))
      );
    }
  } else {
    localSubs = [
      ...localSubs.filter((s: any) => s.execName !== execName),
      sub,
    ];
  }
}

export async function getSubmissions(): Promise<EaSubmission[]> {
  if (redis) {
    const raw = await redis.lrange<string>(KEYS.subs, 0, -1);
    return (raw || []).map((s) => JSON.parse(s)) as EaSubmission[];
  }
  return localSubs;
}

// === Exec availability history log ===
// Used by /api/execs so schedulers can see past availability across requests.

export async function addExecHistoryEntry(entry: ExecHistoryEntry) {
  if (redis) {
    await redis.lpush(KEYS.execHistory, JSON.stringify(entry));
    await redis.ltrim(KEYS.execHistory, 0, 999); // keep latest 1000
  } else {
    localExecHistory.unshift(entry);
    localExecHistory = localExecHistory.slice(0, 1000);
  }
}

export async function getExecHistoryEntries(): Promise<ExecHistoryEntry[]> {
  if (redis) {
    const raw = await redis.lrange<string>(KEYS.execHistory, 0, -1);
    const entries: ExecHistoryEntry[] = [];
    for (const item of raw || []) {
      try {
        entries.push(JSON.parse(item));
      } catch {
        // ignore malformed rows
      }
    }
    return entries;
  }
  return localExecHistory;
}

