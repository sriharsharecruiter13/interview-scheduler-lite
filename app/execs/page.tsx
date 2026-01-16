"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";

type Range = { start: string; end: string };

type ExecHistoryRow = {
  id: string;
  execName: string;
  ranges: Range[];
  at: string;
  candidateName?: string;
  title?: string;
};

function safeDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function tzAbbr(d: Date): string {
  const fmt = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).format(d);
  const parts = fmt.split(" ");
  return parts[parts.length - 1] || "";
}

function formatRanges(ranges: Range[]): { lines: string[]; timezone: string } {
  const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  const sorted = [...(ranges || [])].sort((a, b) => (safeDate(a.start)?.getTime() ?? 0) - (safeDate(b.start)?.getTime() ?? 0));

  let timezone = "";
  const lines: string[] = [];
  for (const r of sorted) {
    const s = safeDate(r.start);
    const e = safeDate(r.end);
    if (!s || !e) continue;

    if (!timezone) timezone = tzAbbr(s);

    const date = dateFmt.format(s);
    const time = `${timeFmt.format(s)} – ${timeFmt.format(e)}`;
    lines.push(`${date} · ${time}`);
  }

  return { lines, timezone };
}

export default function ExecAvailabilityLogPage() {
  const [rows, setRows] = useState<ExecHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Filters
  const [q, setQ] = useState("");
  const [execFilter, setExecFilter] = useState("All execs");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/execs", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load exec availability log");
      const data = (await res.json()) as ExecHistoryRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Failed to load exec availability log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const execOptions = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.execName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return ["All execs", ...names];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (execFilter !== "All execs" && r.execName !== execFilter) return false;
      if (!needle) return true;

      const hay = `${r.execName} ${r.candidateName || ""} ${r.title || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, execFilter]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="execs" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec availability log</h1>
          <p className="text-sm text-slate-600">
            Every EA submission is logged here (most recent first). TACs can check this before reaching out to EAs.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                className="w-full sm:w-80 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Search exec, candidate, title…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              >
                {execOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={load}
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500">No exec availability logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left align-top">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Submitted</th>
                    <th className="py-2 pr-4">Exec</th>
                    <th className="py-2 pr-4">Candidate</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Availability</th>
                    <th className="py-2 pr-4">TZ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const at = safeDate(r.at);
                    const { lines, timezone } = formatRanges(r.ranges || []);
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">
                          {at ? at.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap font-medium">{r.execName}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-700">{r.candidateName || "—"}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-700">{r.title || "—"}</td>
                        <td className="py-2 pr-4 text-xs text-slate-800">
                          {lines.length ? (
                            <div className="space-y-1">
                              {lines.map((x, i) => (
                                <div key={i}>{x}</div>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">{timezone || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

