import { NextResponse } from "next/server";
import {
  addChatMessage,
  getChatMessages,
  type ChatRole,
} from "../../../lib/chatStore";

export const runtime = "nodejs";

// GET /api/chat -> { messages: ChatMessage[] }
export async function GET() {
  try {
    const messages = await getChatMessages();
    return NextResponse.json({ messages });
  } catch (e) {
    console.error("GET /api/chat failed", e);
    return NextResponse.json(
      { error: "Failed to load chat messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat -> body: { role: "tac" | "ea"; text: string }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const role = (body?.role || "").trim() as ChatRole;
    const text = (body?.text || "").trim();

    if (!role || (role !== "tac" && role !== "ea")) {
      return NextResponse.json(
        { error: "Invalid role (must be 'tac' or 'ea')" },
        { status: 400 }
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "Message text is required" },
        { status: 400 }
      );
    }

    const msg = await addChatMessage(role, text);
    const messages = await getChatMessages();

    // Bot hook in the future can go here:
    // - call OpenAI
    // - await addChatMessage("bot", reply)
    // - reload messages

    return NextResponse.json({ ok: true, message: msg, messages });
  } catch (e) {
    console.error("POST /api/chat failed", e);
    return NextResponse.json(
      { error: "Failed to post chat message" },
      { status: 500 }
    );
  }
}

