import { Redis } from "@upstash/redis";
import type { Window, EaSubmission } from "./db";

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

let localWindow: Window | null = null;
// local fallback as a map: execName -> submission
let localSubsMap: Record<string, EaSubmission> = {};

const KEYS = {
  window: "isl:window",
  // change from LIST to HASH so each exec has exactly one record
  subsHash: "isl:subs_hash_v1",
};

function normExecName(name: string) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " "); // collapse extra spaces
}

export async function saveWindow(win: Window) {
  if (redis) {
    await redis.set(KEYS.window, win);
    // NOTE: we do NOT clear subs on new window unless you want that behavior.
    // If you want "new window resets submissions", uncomment:
    // await redis.del(KEYS.subsHash);
  } else {
    localWindow = win;
  }
}

export async function getWindow(): Promise<Window | null> {
  if (redis) return (await redis.get<Window>(KEYS.window)) || null;
  return localWindow;
}

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
      } catch {
        // ignore malformed
      }
    }
    // stable ordering by execName
    out.sort((a: any, b: any) =>
      String(a.execName || "").localeCompare(String(b.execName || ""))
    );
    return out;
  }

  return Object.values(localSubsMap).sort((a: any, b: any) =>
    String(a.execName || "").localeCompare(String(b.execName || ""))
  );
}

