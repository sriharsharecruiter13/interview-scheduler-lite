import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  const hasUpstash = !!url && !!token;

  const KEYS = {
    window: "isl:window",
    subsHash: "isl:subs_hash_v1",
    execHistory: "isl:exec_history_v1",
    // If you also want to clear chat, uncomment the next line
    // chat: "isl:chat_v1",
  };

  if (!hasUpstash) {
    return NextResponse.json(
      { ok: false, error: "Upstash env vars missing; cannot reset." },
      { status: 500 }
    );
  }

  const redis = Redis.fromEnv();

  // Delete keys
  const keysToDelete = Object.values(KEYS);
  const deleted = await redis.del(...keysToDelete);

  return NextResponse.json({
    ok: true,
    deletedCount: deleted,
    keysDeleted: keysToDelete,
  });
}

