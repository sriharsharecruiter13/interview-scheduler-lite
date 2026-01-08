"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "tac" | "ea" | "bot";
type ChatMessage = { id: string; role: ChatRole; text: string; at: string };

export default function ChatPanel({ role }: { role: "tac" | "ea" }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      setError("");
      const res = await fetch("/api/chat", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Chat load failed (${res.status})`);
      }
      setMessages(data?.messages || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load chat");
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`);
      setMessages(data?.messages || []);
      setInput("");
    } catch (e: any) {
      setError(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    [messages]
  );

  function label(r: ChatRole) {
    if (r === "tac") return "TAC";
    if (r === "ea") return "EA";
    return "Assistant";
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm flex flex-col gap-3 h-[360px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scheduling chat</div>
          <p className="text-[11px] text-slate-500">Shared between TAC and EAs.</p>
        </div>
        <button type="button" onClick={load} className="text-[11px] text-sky-600 hover:text-sky-500">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sorted.length === 0 && !error && (
          <div className="text-xs text-slate-500">No messages yet.</div>
        )}

        {sorted.map((m) => (
          <div key={m.id} className="text-xs">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-slate-700">{label(m.role)}</span>
              <span className="text-[10px] text-slate-400">{new Date(m.at).toLocaleString()}</span>
            </div>
            <div className="mt-0.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-900">
              {m.text}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />

        {error && (
          <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-2 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
          placeholder={role === "tac" ? "Message EAs…" : "Message TAC…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </section>
  );
}

