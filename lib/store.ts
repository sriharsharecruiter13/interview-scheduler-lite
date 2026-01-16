import { Redis } from "@upstash/redis";
import type { Window, EaSubmission } from "./db";

export const runtime = "nodejs";

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

let localWindow: Window | null = null;
let localSubsMap: Record<string, EaSubmission> = {};
let localHistory: ExecHistoryEntry[] = [];

const KEYS = {
  window: "isl:window",
  subsHash: "isl:subs_hash_v1",
  execHistory: "isl:exec_history_v1",
};

function normExecName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

/** ---------------- Window ---------------- **/

export async function saveWindow(win: Window) {
  if (redis) {
    await redis.set(KEYS.window, win);
    // reset CURRENT availability per window/candidate
    await redis.del(KEYS.subsHash);
  } else {
    localWindow = win;
    localSubsMap = {};
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

  const clean: EaSubmission = { ...(sub as any), execName };

  if (redis) {
    // store as JSON string (stable)
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

/**
 * Upstash hgetall() can return:
 * - object map: { key: value }
 * - array pairs: [[key,value], ...]
 */
function normalizeHgetallPairs(raw: any): Array<[string, any]> {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((x) => Array.isArray(x) && x.length >= 2)
      .map((x) => [String(x[0]), x[1]] as [string, any]);
  }

  if (typeof raw === "object") {
    return Object.entries(raw).map(([k, v]) => [String(k), v] as [string, any]);
  }

  return [];
}

function coerceSubmission(v: any): EaSubmission | null {
  if (!v) return null;

  if (typeof v === "object") {
    const execName = normExecName(v.execName);
    if (!execName) return null;
    const ranges = Array.isArray(v.ranges) ? v.ranges : [];
    return { ...v, execName, ranges } as EaSubmission;
  }

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object") {
        const execName = normExecName(parsed.execName);
        if (!execName) return null;
        const ranges = Array.isArray(parsed.ranges) ? parsed.ranges : [];
        return { ...parsed, execName, ranges } as EaSubmission;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function getSubmissions(): Promise<EaSubmission[]> {
  if (redis) {
    const raw = await redis.hgetall<any>(KEYS.subsHash);
    const pairs = normalizeHgetallPairs(raw);

    const out: EaSubmission[] = [];
    for (const [, v] of pairs) {
      const sub = coerceSubmission(v);
      if (sub) out.push(sub);
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
    // store as JSON string (stable)
    await redis.lpush(KEYS.execHistory, JSON.stringify(row));
    await redis.ltrim(KEYS.execHistory, 0, 1999);
  } else {
    localHistory.unshift(row);
    localHistory = localHistory.slice(0, 2000);
  }
}

function coerceHistoryRow(v: any): ExecHistoryEntry | null {
  if (!v) return null;

  // Already object
  if (typeof v === "object") {
    const execName = normExecName(v.execName);
    if (!execName) return null;
    const ranges = Array.isArray(v.ranges) ? v.ranges : [];
    const at = String(v.at || "");
    if (!at) return null;
    return {
      id: String(v.id || makeId()),
      execName,
      ranges,
      at,
      candidateName: v.candidateName,
      title: v.title,
    };
  }

  // JSON string
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return coerceHistoryRow(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

export async function getExecHistoryEntries(): Promise<ExecHistoryEntry[]> {
  if (redis) {
    const raw = await redis.lrange<any>(KEYS.execHistory, 0, -1);

    const out: ExecHistoryEntry[] = [];
    for (const item of raw || []) {
      const row = coerceHistoryRow(item);
      if (row) out.push(row);
    }
    return out;
  }

  return localHistory;
}

