"use client";

import { useEffect, useState } from "react";

type Range = { start: string; end: string };

type ExecEntry = {
  execName: string;
  ranges: Range[];
};

type Row = {
  execName: string;
  date: string;
  time: string;
  timezone: string;
};

function parseISO(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getTimeZoneAbbr(d: Date): string {
  // e.g. "Dec 7, 2025, 9:00 AM PST" -> "PST"
  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZoneName: "short",
  }).format(d);
  const parts = fmt.split(" ");
  return parts[parts.length - 1] || "";
}

function toRows(entries: ExecEntry[]): Row[] {
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

  for (const e of entries) {
    for (const r of e.ranges) {
      const s = parseISO(r.start);
      const en = parseISO(r.end);
      if (!s || !en) continue;

      const date = dateFmt.format(s);
      const time = `${timeFmt.format(s)} – ${timeFmt.format(en)}`;
      const tz = getTimeZoneAbbr(s);

      rows.push({
        execName: e.execName,
        date,
        time,
        timezone: tz,
      });
    }
  }

  return rows;
}

export default function ExecAvailabilityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/execs");
      if (!res.ok) return;
      const data = (await res.json()) as ExecEntry[];
      setRows(toRows(data));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        {/* Nav row */}
        <nav className="flex flex-wrap gap-2 items-center mb-4">
          <a
            href="/"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Scheduler
          </a>
          <a
            href="/respond"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            EA page
          </a>
          <a
            href="/dashboard"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dashboard
          </a>
          <a
            href="/candidates"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Candidate log
          </a>
          <a
            href="/execs"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-50 text-slate-900"
          >
            Exec availability
          </a>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec availability</h1>
          <p className="text-sm text-slate-400">
            One row per exec time range, pulled from EA submissions.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          {loading && rows.length === 0 ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-400">
              No exec availability submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Exec name</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Timezone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.execName}-${idx}`}
                      className="border-b border-slate-800/60 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">
                        {row.execName}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.time}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.timezone}
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

