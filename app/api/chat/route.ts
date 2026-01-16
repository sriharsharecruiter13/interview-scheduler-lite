import { NextResponse } from "next/server";
import { appendChatMessage, clearChat, getChatMessages } from "../../../lib/chatStore";

export const runtime = "nodejs";

export async function GET() {
  const messages = await getChatMessages();
  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const role = (body?.role || "ea") as "ea" | "assistant" | "system";
    const text = String(body?.text || "").trim();

    if (!text) {
      return NextResponse.json({ ok: false, error: "Message is empty." }, { status: 400 });
    }

    const msg = await appendChatMessage({ role, text });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

// Optional reset endpoint via DELETE
export async function DELETE() {
  await clearChat();
  return NextResponse.json({ ok: true });
}

