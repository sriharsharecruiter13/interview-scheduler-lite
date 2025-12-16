import { Redis } from "@upstash/redis";

const chatRedis = Redis.fromEnv();

export type ChatRole = "tac" | "ea" | "bot";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string; // ISO timestamp
};

const CHAT_KEY = "isl:chat_current_window_v1";

// Keep only the latest N messages so it doesn't grow forever
const MAX_MESSAGES = 200;

export async function getChatMessages(): Promise<ChatMessage[]> {
  const raw = await chatRedis.lrange<string>(CHAT_KEY, 0, -1);
  const out: ChatMessage[] = [];

  for (const item of raw) {
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

export async function addChatMessage(role: ChatRole, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: trimmed,
    at: new Date().toISOString(),
  };

  await chatRedis.rpush(CHAT_KEY, JSON.stringify(msg));
  await chatRedis.ltrim(CHAT_KEY, -MAX_MESSAGES, -1);
  return msg;
}

// (Later, when you add the real bot, you can call addChatMessage("bot", replyText)
// from your /api/chat route after calling OpenAI.)

