import { Redis } from "@upstash/redis";

export type ChatRole = "tac" | "ea" | "bot";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string; // ISO timestamp
};

// Use same pattern as lib/store.ts: Upstash if available, else local memory
const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;

const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

const CHAT_KEY = "isl:chat_current_window_v1";
const MAX_MESSAGES = 200;

// Local in-memory fallback (for dev when no Redis env vars)
let localMessages: ChatMessage[] = [];

export async function getChatMessages(): Promise<ChatMessage[]> {
  if (redis) {
    const raw = await redis.lrange<string>(CHAT_KEY, 0, -1);
    const out: ChatMessage[] = [];

    for (const item of raw || []) {
      try {
        const parsed = JSON.parse(item) as ChatMessage;
        if (parsed && parsed.id && parsed.text) {
          out.push(parsed);
        }
      } catch {
        // ignore bad rows
      }
    }

    return out;
  }

  // No Redis → just use in-memory messages
  return localMessages;
}

export async function addChatMessage(
  role: ChatRole,
  text: string
): Promise<ChatMessage | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: trimmed,
    at: new Date().toISOString(),
  };

  if (redis) {
    await redis.rpush(CHAT_KEY, JSON.stringify(msg));
    await redis.ltrim(CHAT_KEY, -MAX_MESSAGES, -1);
  } else {
    localMessages.push(msg);
    if (localMessages.length > MAX_MESSAGES) {
      localMessages = localMessages.slice(-MAX_MESSAGES);
    }
  }

  return msg;
}

