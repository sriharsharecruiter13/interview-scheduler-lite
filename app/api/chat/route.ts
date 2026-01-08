import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

type ChatRole = "tac" | "ea" | "bot";
type ChatMessage = { id: string; role: ChatRole; text: string; at: string };

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

const CHAT_KEY = "isl:chat_current_window_v1";
const MAX_MESSAGES = 200;

let localMessages: ChatMessage[] = [];

async function getMessages(): Promise<ChatMessage[]> {
  if (redis) {
    const raw = await redis.lrange<string>(CHAT_KEY, 0, -1);
    const out: ChatMessage[] = [];
    for (const item of raw || []) {
      try {
        out.push(JSON.parse(item));
      } catch {}
    }
    return out;
  }
  return localMessages;
}

async function addMessage(role: ChatRole, text: string): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: text.trim(),
    at: new Date().toISOString(),
  };

  if (redis) {
    await redis.rpush(CHAT_KEY, JSON.stringify(msg));
    await redis.ltrim(CHAT_KEY, -MAX_MESSAGES, -1);
  } else {
    localMessages.push(msg);
    if (localMessages.length > MAX_MESSAGES) localMessages = localMessages.slice(-MAX_MESSAGES);
  }

  return msg;
}

export async function GET() {
  try {
    const messages = await getMessages();
    return NextResponse.json({ messages });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const role = String(body?.role || "").trim() as ChatRole;
    const text = String(body?.text || "").trim();

    if (role !== "tac" && role !== "ea") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Message text required" }, { status: 400 });
    }

    await addMessage(role, text);
    const messages = await getMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to send" }, { status: 500 });
  }
}

