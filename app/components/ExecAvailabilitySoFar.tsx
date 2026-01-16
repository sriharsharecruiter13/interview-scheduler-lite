"use client";

import React, { useEffect, useMemo, useState } from "react";

type Range = {
  start?: string;
  end?: string;
  startISO?: string;
  endISO?: string;
};

type Submission = {
  execName?: string;
  execKey?: string;
  ranges?: Range[];
  at?: string;
  submittedAt?: number;
  source?: string;
};

type WindowApiResponse = {
  window: any;
  submissions: Submission[];
};

function normExecName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeRange(r: Range): { start: string; end: string } | null {
  const start = (r.start ?? r.startISO ?? "").toString();
  const end = (r.end ?? r.endISO ?? "").toString();
  if (!start || !end) return null;

  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;

  return { start, end };
}

function fmtLocal(dt: string) {
  const t = new Date(dt);
  if (!Number.isFinite(t.getTime())) return dt;
  return t.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtShort(dt: string) {
  const t = new Date(dt);
  if (!Number.isFinite(t.getTime())) return dt;
  return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toSubmittedLabel(s: Submission) {
  if (typeof s.submittedAt === "number") {
    const t = new Date(s.submittedAt);
    if (Number.isFinite(t.getTime())) return fmtLocal(t.toISOString());
  }
  if (s.at) return fmtLocal(s.at);
  return "";
}

export default function ExecAvailabilitySoFar(props: { pollMs?: number }) {
  const pollMs = props.pollMs ?? 4000;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);

  async function load() {
    try {
      setErr(null);
      const r = await fetch("/api/window", { cache: "no-store" });
      if (!r.ok) throw new Error(`GET /api/window failed: ${r.status}`);
      const data = (await r.json()) as WindowApiResponse;
      setSubs(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load exec availability.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, pollMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  const rows = useMemo(() => {
    // Normalize + filter empty
    const cleaned = (subs || [])
      .map((s) => ({
        ...s,
        execName: normExecName(s.execName || s.execKey || ""),
        ranges: Array.isArray(s.ranges) ? s.ranges : [],
      }))
      .filter((s) => !!s.execName);

    // Sort by exec name
    cleaned.sort((a, b) => (a.execName || "").localeCompare(b.execName || ""));

    // Build renderable rows
    return cleaned.map((s) => {
      const nr = (s.ranges || [])
        .map(normalizeRange)
        .filter(Boolean) as { start: string; end: string }[];

      nr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return {
        execName: s.execName!,
        submitted: toSubmittedLabel(s),
        ranges: nr,
      };
    });
  }, [subs]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Exec availability so far</div>
          <div className="text-xs text-slate-300">
            Live updates every {Math.round(pollMs / 1000)}s
          </div>
        </div>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
          onClick={() => load()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : err ? (
        <div className="text-sm text-rose-300">{err}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-300">
          No exec availability submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.execName} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-100">{row.execName}</div>
                {row.submitted ? (
                  <div className="text-xs text-slate-400">Last submitted: {row.submitted}</div>
                ) : null}
              </div>

              {row.ranges.length === 0 ? (
                <div className="mt-2 text-sm text-slate-300">No valid time ranges.</div>
              ) : (
                <ul className="mt-2 space-y-1">
                  {row.ranges.map((r, idx) => (
                    <li key={idx} className="text-sm text-slate-200">
                      <span className="text-slate-400">{fmtLocal(r.start).split(",")[0]}</span>{" "}
                      <span className="font-medium">{fmtShort(r.start)}</span>
                      {" – "}
                      <span className="font-medium">{fmtShort(r.end)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

