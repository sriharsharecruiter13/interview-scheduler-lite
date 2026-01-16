import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;
const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

const KEY = "isl:chat_v1";

export type ChatMessage = {
  id: string;
  at: string; // ISO
  role: "ea" | "assistant" | "system";
  text: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let localMessages: ChatMessage[] = [];

export async function getChatMessages(): Promise<ChatMessage[]> {
  if (redis) {
    const raw = await redis.lrange<any>(KEY, 0, -1);
    const out: ChatMessage[] = [];

    for (const item of raw || []) {
      // Upstash may return already-parsed objects OR strings
      if (item && typeof item === "object") out.push(item as ChatMessage);
      else if (typeof item === "string") {
        try {
          out.push(JSON.parse(item));
        } catch {}
      }
    }
    return out;
  }

  return localMessages;
}

export async function appendChatMessage(input: Omit<ChatMessage, "id" | "at">) {
  const msg: ChatMessage = {
    id: makeId(),
    at: new Date().toISOString(),
    role: input.role,
    text: String(input.text || ""),
  };

  if (redis) {
    await redis.rpush(KEY, JSON.stringify(msg));
    // cap to last 500 messages
    const len = await redis.llen(KEY);
    if (len > 500) {
      await redis.ltrim(KEY, len - 500, -1);
    }
  } else {
    localMessages.push(msg);
    if (localMessages.length > 500) localMessages = localMessages.slice(-500);
  }

  return msg;
}

export async function clearChat() {
  if (redis) {
    await redis.del(KEY);
  } else {
    localMessages = [];
  }
}

