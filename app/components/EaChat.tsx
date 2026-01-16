"use client";

import React, { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  at: string;
  role: "ea" | "assistant" | "system";
  text: string;
};

export default function EaChat(props: { pollMs?: number }) {
  const pollMs = props.pollMs ?? 3000;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      setErr(null);
      const r = await fetch("/api/chat", { cache: "no-store" });
      if (!r.ok) throw new Error(`GET /api/chat failed: ${r.status}`);
      const data = await r.json();
      const list = Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : [];
      setMessages(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load chat.");
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, pollMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setErr(null);

    // optimistic insert so it never “disappears”
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      at: new Date().toISOString(),
      role: "ea",
      text: msg,
    };
    setMessages((m) => [...m, optimistic]);
    setText("");

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "ea", text: msg }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `POST /api/chat failed: ${r.status}`);
      }
      // refresh from server to replace optimistic id with real id
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">EA Chat</div>
          <div className="text-xs text-slate-300">Persists in Redis • refreshes every {Math.round(pollMs / 1000)}s</div>
        </div>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
          type="button"
          onClick={() => load()}
        >
          Refresh
        </button>
      </div>

      {err ? <div className="mb-2 text-sm text-rose-300">{err}</div> : null}

      <div className="h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400">No messages yet.</div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="text-slate-400">
                  [{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]
                </span>{" "}
                <span className="font-semibold text-slate-200">{m.role.toUpperCase()}:</span>{" "}
                <span className="text-slate-100">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60"
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
        >
          Send
        </button>
      </div>
    </section>
  );
}

