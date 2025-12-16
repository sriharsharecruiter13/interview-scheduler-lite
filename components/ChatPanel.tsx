"use client";

import { useEffect, useMemo, useState } from "react";

type ChatRole = "tac" | "ea" | "bot";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string;
};

type ChatPanelProps = {
  role: "tac" | "ea"; // page decides
};

export default function ChatPanel({ role }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function load() {
    try {
      setError("");
      const res = await fetch("/api/chat");
      if (!res.ok) throw new Error("Failed to load chat");
      const data = await res.json();
      setMessages(data?.messages || []);
    } catch (e: any) {
      setError(e.message || "Failed to load chat");
    }
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send");
      }
      const data = await res.json();
      setMessages(data?.messages || []);
      setInput("");
    } catch (e: any) {
      setError(e.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(
    () =>
      [...messages].sort((a, b) => {
        return new Date(a.at).getTime() - new Date(b.at).getTime();
      }),
    [messages]
  );

  function labelForRole(r: ChatRole) {
    if (r === "tac") return "TAC";
    if (r === "ea") return "EA";
    if (r === "bot") return "Assistant";
    return r;
  }

  function bubbleClasses(r: ChatRole) {
    if (r === "bot")
      return "bg-indigo-50 border border-indigo-200 text-indigo-900";
    if (r === "tac")
      return "bg-slate-100 border border-slate-200 text-slate-900";
    if (r === "ea")
      return "bg-sky-50 border border-sky-200 text-sky-900";
    return "bg-slate-50 border border-slate-200 text-slate-900";
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm flex flex-col gap-3 h-[360px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Scheduling chat
          </div>
          <p className="text-[11px] text-slate-500">
            Shared thread between TAC, EAs, and (later) the scheduling assistant
            bot. Use this to coordinate changes to availability.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-[11px] text-sky-600 hover:text-sky-500"
        >
          Refresh
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sorted.length === 0 && !error && (
          <div className="text-xs text-slate-500">
            No messages yet. Start the conversation below.
          </div>
        )}
        {sorted.map((m) => (
          <div key={m.id} className="flex flex-col gap-0.5 text-xs">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-slate-700">
                {labelForRole(m.role)}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(m.at).toLocaleString()}
              </span>
            </div>
            <div
              className={
                "inline-block px-2 py-1 rounded-xl text-[11px] " +
                bubbleClasses(m.role)
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 pt-2 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
          placeholder={
            role === "tac"
              ? "Type a note for EA or ask a question about this schedule…"
              : "Type a note for TAC (e.g. changes, constraints)…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </section>
  );
}

