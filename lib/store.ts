import { Redis } from "@upstash/redis";
import type { Window, EaSubmission } from "./db";

export const runtime = "nodejs";

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

let localWindow: Window | null = null;
// current submissions (latest per exec)
let localSubsMap: Record<string, EaSubmission> = {};
// history log
let localHistory: ExecHistoryEntry[] = [];

const KEYS = {
  window: "isl:window",
  subsHash: "isl:subs_hash_v1", // current, 1 per exec
  execHistory: "isl:exec_history_v1", // history log
};

function normExecName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

/** ---------------- Window ---------------- **/

export async function saveWindow(win: Window) {
  if (redis) {
    await redis.set(KEYS.window, win);
    // NOTE: we intentionally do NOT clear current submissions or history here
    // to preserve visibility across windows.
  } else {
    localWindow = win;
  }
}

export async function getWindow(): Promise<Window | null> {
  if (redis) return (await redis.get<Window>(KEYS.window)) || null;
  return localWindow;
}

/** ---------------- Current submissions (latest per exec) ---------------- **/

export async function upsertSubmission(sub: EaSubmission) {
  const execName = normExecName((sub as any)?.execName);
  if (!execName) return;

  const clean: EaSubmission = {
    ...(sub as any),
    execName,
  };

  if (redis) {
    await redis.hset(KEYS.subsHash, { [execName]: JSON.stringify(clean) });
  } else {
    localSubsMap[execName] = clean;
  }
}

export async function removeSubmission(execNameRaw: string) {
  const execName = normExecName(execNameRaw);
  if (!execName) return;

  if (redis) {
    await redis.hdel(KEYS.subsHash, execName);
  } else {
    delete localSubsMap[execName];
  }
}

export async function getSubmissions(): Promise<EaSubmission[]> {
  if (redis) {
    const obj = (await redis.hgetall<Record<string, string>>(KEYS.subsHash)) || {};
    const out: EaSubmission[] = [];
    for (const [, v] of Object.entries(obj)) {
      try {
        out.push(JSON.parse(v));
      } catch {}
    }
    out.sort((a: any, b: any) =>
      String(a.execName || "").localeCompare(String(b.execName || ""))
    );
    return out;
  }

  return Object.values(localSubsMap).sort((a: any, b: any) =>
    String(a.execName || "").localeCompare(String(b.execName || ""))
  );
}

/** ---------------- Exec availability history (across windows) ---------------- **/

export type ExecHistoryRange = { start: string; end: string };

export type ExecHistoryEntry = {
  id: string;
  execName: string;
  ranges: ExecHistoryRange[];
  at: string; // submission time
  candidateName?: string;
  title?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addExecHistoryEntry(entry: Omit<ExecHistoryEntry, "id">) {
  const cleanExec = normExecName(entry.execName);
  if (!cleanExec) return;

  const row: ExecHistoryEntry = {
    ...entry,
    id: makeId(),
    execName: cleanExec,
  };

  if (redis) {
    // push newest first
    await redis.lpush(KEYS.execHistory, JSON.stringify(row));
    // cap size to keep storage bounded
    await redis.ltrim(KEYS.execHistory, 0, 1999);
  } else {
    localHistory.unshift(row);
    localHistory = localHistory.slice(0, 2000);
  }
}

export async function getExecHistoryEntries(): Promise<ExecHistoryEntry[]> {
  if (redis) {
    const raw = await redis.lrange<string>(KEYS.execHistory, 0, -1);
    const entries: ExecHistoryEntry[] = [];
    for (const item of raw || []) {
      try {
        entries.push(JSON.parse(item));
      } catch {}
    }
    return entries;
  }
  return localHistory;
}

