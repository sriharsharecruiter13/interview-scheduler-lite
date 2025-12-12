"use client";

import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";

type Range = { start: string; end: string };

type ExecEntryFromApi = {
  execName: string;
  ranges: Range[];
  at?: string;
  // (api may include more fields; we ignore them)
};

type Row = {
  execName: string;
  availabilityLabel: string;
  timezone: string;
};

function parseISO(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getTimeZoneAbbr(d: Date): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZoneName: "short",
  }).format(d);
  const parts = fmt.split(" ");
  return parts[parts.length - 1] || "";
}

function toRows(entries: ExecEntryFromApi[]): Row[] {
  // 1) Group all ranges by execName
  const map = new Map<string, Range[]>();

  for (const entry of entries) {
    if (!entry.execName) continue;
    if (!Array.isArray(entry.ranges)) continue;

    if (!map.has(entry.execName)) {
      map.set(entry.execName, []);
    }
    const arr = map.get(entry.execName)!;
    for (const r of entry.ranges) {
      if (r.start && r.end) {
        arr.push(r);
      }
    }
  }

  const rows: Row[] = [];

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  for (const [execName, ranges] of map.entries()) {
    if (ranges.length === 0) continue;

    // Sort ranges by start time for nicer display
    const sorted = [...ranges].sort((a, b) => {
      const sa = parseISO(a.start)?.getTime() ?? 0;
      const sb = parseISO(b.start)?.getTime() ?? 0;
      return sa - sb;
    });

    const pieces: string[] = [];
    let timezone = "";

    for (const r of sorted) {
      const s = parseISO(r.start);
      const e = parseISO(r.end);
      if (!s || !e) continue;

      const date = dateFmt.format(s);
      const time = `${timeFmt.format(s)} – ${timeFmt.format(e)}`;
      if (!timezone) {
        timezone = getTimeZoneAbbr(s);
      }

      pieces.push(`${date} · ${time}`);
    }

    if (pieces.length === 0) continue;

    rows.push({
      execName,
      availabilityLabel: pieces.join(" • "),
      timezone: timezone || "",
    });
  }

  // Sort execs alphabetically for a stable list
  rows.sort((a, b) => a.execName.localeCompare(b.execName));

  return rows;
}

export default function ExecAvailabilityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/execs");
      if (!res.ok) {
        throw new Error("Failed to load exec availability");
      }
      const data = (await res.json()) as ExecEntryFromApi[];
      setRows(toRows(data));
    } catch (e: any) {
      setError(e.message || "Failed to load exec availability");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="execs" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec availability</h1>
          <p className="text-sm text-slate-600">
            Combined availability per exec, pulled from EA submissions history.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-500">
              No exec availability submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left align-top">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Exec name</th>
                    <th className="py-2 pr-4">Availability</th>
                    <th className="py-2 pr-4">Timezone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.execName}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">
                        {row.execName}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-slate-800 whitespace-pre-wrap">
                          {row.availabilityLabel}
                        </span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">
                        {row.timezone || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

