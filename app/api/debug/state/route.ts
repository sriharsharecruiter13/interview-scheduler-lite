import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  const hasUpstash = !!url && !!token;

  const KEYS = {
    window: "isl:window",
    subsHash: "isl:subs_hash_v1",
    execHistory: "isl:exec_history_v1",
  };

  if (!hasUpstash) {
    return NextResponse.json({
      ok: true,
      hasUpstash,
      urlPresent: !!url,
      tokenPresent: !!token,
      keys: KEYS,
      note: "Upstash env vars missing in runtime; routes may be using in-memory fallback.",
    });
  }

  const redis = Redis.fromEnv();

  const [windowVal, subsCount, histLen, subsSampleRaw] = await Promise.all([
    redis.get(KEYS.window),
    redis.hlen(KEYS.subsHash),
    redis.llen(KEYS.execHistory),
    redis.hgetall(KEYS.subsHash),
  ]);

  const subsSample = Array.isArray(subsSampleRaw)
    ? subsSampleRaw.slice(0, 3)
    : Object.entries(subsSampleRaw || {}).slice(0, 3);

  return NextResponse.json({
    ok: true,
    hasUpstash,
    urlPrefix: url.slice(0, 28) + "...",
    keys: KEYS,
    windowExists: !!windowVal,
    subsCount,
    histLen,
    subsSample,
  });
}

