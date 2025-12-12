"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";

type Range = { start: string; end: string };

type Submission = {
  execName: string;
  ranges: Range[];
  at?: string;
};

type WindowResponse = {
  window?: {
    candidateName?: string;
    title?: string;
    candidateRanges?: Range[];
    execList?: string;
  };
  submissions?: Submission[];
};

type Slot = {
  start: Date;
  end: Date;
  execs: string[];
};

function parseISO(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateRange(start: Date, end: Date) {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const datePart = dateFmt.format(start);
  const s = timeFmt.format(start);
  const e = timeFmt.format(end);

  return {
    dateLabel: datePart,
    timeLabel: `${s} – ${e}`,
    sameDay,
  };
}

function humanCandidateWindow(ranges: Range[] | undefined | null): string {
  if (!ranges || ranges.length === 0) return "Not provided";

  const start = parseISO(ranges[0].start);
  const end = parseISO(ranges[ranges.length - 1].end);
  if (!start || !end) return "Not provided";

  const { dateLabel, timeLabel } = formatDateRange(start, end);
  return `${dateLabel} ${timeLabel}`;
}

function isCovered(ranges: Range[], start: Date, end: Date): boolean {
  const sMs = start.getTime();
  const eMs = end.getTime();
  return ranges.some((r) => {
    const rs = parseISO(r.start);
    const re = parseISO(r.end);
    if (!rs || !re) return false;
    return rs.getTime() <= sMs && re.getTime() >= eMs;
  });
}

function generateSlots(
  candidateRanges: Range[],
  submissions: Submission[],
  meetingMinutes = 60,
  stepMinutes = 30
): Slot[] {
  if (candidateRanges.length === 0) return [];

  const starts = candidateRanges
    .map((r) => parseISO(r.start))
    .filter((d): d is Date => !!d);
  const ends = candidateRanges
    .map((r) => parseISO(r.end))
    .filter((d): d is Date => !!d);
  if (starts.length === 0 || ends.length === 0) return [];

  const minStart = new Date(Math.min(...starts.map((d) => d.getTime())));
  const maxEnd = new Date(Math.max(...ends.map((d) => d.getTime())));

  const stepMs = stepMinutes * 60 * 1000;
  const meetingMs = meetingMinutes * 60 * 1000;

  const slots: Slot[] = [];

  for (
    let t = minStart.getTime();
    t + meetingMs <= maxEnd.getTime();
    t += stepMs
  ) {
    const s = new Date(t);
    const e = new Date(t + meetingMs);

    if (!isCovered(candidateRanges, s, e)) continue;

    const execs: string[] = [];
    for (const sub of submissions) {
      if (!sub.ranges || sub.ranges.length === 0) continue;
      if (isCovered(sub.ranges, s, e)) {
        execs.push(sub.execName);
      }
    }

    if (execs.length > 0) {
      slots.push({ start: s, end: e, execs });
    }
  }

  return slots;
}

// Helper: hide emails from execList for dashboard display
function stripExecEmails(execList: string): string {
  if (!execList) return "";
  return execList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[-–—]/);
      return (parts[0] || "").trim();
    })
    .filter(Boolean)
    .join("\n");
}

export default function DashboardPage() {
  const [data, setData] = useState<WindowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/window");
      const j = (await r.json()) as WindowResponse;
      setData(j);
    } catch (e) {
      console.error("Failed to load window", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const candidateName = data?.window?.candidateName ?? "Candidate";
  const candidateTitle = data?.window?.title ?? "";
  const candidateRanges = data?.window?.candidateRanges ?? [];
  const rawExecList = data?.window?.execList ?? "";
  const submissions = data?.submissions ?? [];

  const execListNamesOnly = useMemo(
    () => stripExecEmails(rawExecList),
    [rawExecList]
  );

  const candidateWindowLabel = humanCandidateWindow(candidateRanges);

  const { majoritySlot, nextSlots, askToFlex } = useMemo(() => {
    if (!candidateRanges.length || !submissions.length) {
      return {
        majoritySlot: null as Slot | null,
        nextSlots: [] as Slot[],
        askToFlex: [] as string[],
      };
    }

    const slots = generateSlots(candidateRanges, submissions, 60, 30);
    if (!slots.length) {
      return {
        majoritySlot: null,
        nextSlots: [],
        askToFlex: [],
      };
    }

    const sorted = [...slots].sort((a, b) => {
      if (b.execs.length !== a.execs.length) {
        return b.execs.length - a.execs.length;
      }
      return a.start.getTime() - b.start.getTime();
    });

    const majoritySlot = sorted[0];
    const maxExecs = majoritySlot.execs.length;

    const nextSlots = sorted
      .slice(1)
      .filter((s) => s.execs.length >= Math.max(2, maxExecs - 1));

    const allExecNames = Array.from(
      new Set(submissions.map((s) => s.execName))
    );
    const askToFlex = allExecNames.filter(
      (name) => !majoritySlot.execs.includes(name)
    );

    return { majoritySlot, nextSlots, askToFlex };
  }, [candidateRanges, submissions]);

  const groupedExec = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const s of submissions) {
      for (const r of s.ranges || []) {
        const start = parseISO(r.start);
        const end = parseISO(r.end);
        if (!start || !end) continue;

        const dayLabel = new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(start);

        map[dayLabel] ||= {};
        map[dayLabel][s.execName] ||= [];

        const timeFmt = new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

        map[dayLabel][s.execName].push(
          `${timeFmt.format(start)} – ${timeFmt.format(end)}`
        );
      }
    }
    return map;
  }, [submissions]);

  const execNames = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.execName))),
    [submissions]
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="dashboard" />

        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Live view of EA submissions and common 60-min windows for this
            candidate.
          </p>
        </header>

        {/* Candidate card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Candidate
            </div>
            <div className="text-lg font-semibold">{candidateName}</div>
            {candidateTitle && (
              <div className="text-sm text-slate-700">{candidateTitle}</div>
            )}
            <div className="mt-3 text-sm font-semibold text-slate-800">
              Candidate availability
            </div>
            <div className="text-sm text-slate-800">
              {candidateWindowLabel}
            </div>
          </div>

          {execListNamesOnly && (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-800">
                Execs for this request
              </div>
              <pre className="text-sm text-slate-800 whitespace-pre-wrap rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                {execListNamesOnly}
              </pre>
            </div>
          )}
        </section>

        {/* EA submissions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            EA submissions
          </h2>
          {loading && submissions.length === 0 ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="text-sm text-slate-500">No EA submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Exec</th>
                    <th className="py-2 pr-4">Submitted at</th>
                    <th className="py-2 pr-4">Ranges</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {s.execName}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-500 text-xs">
                        {s.at ? new Date(s.at).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-800">
                        {s.ranges
                          .map((r) => {
                            const start = parseISO(r.start);
                            const end = parseISO(r.end);
                            if (!start || !end) return "";
                            const { dateLabel, timeLabel } =
                              formatDateRange(start, end);
                            return `${dateLabel} ${timeLabel}`;
                          })
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Exec availability grouped by day */}
        {Object.keys(groupedExec).length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Exec availability so far (grouped by day)
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    {execNames.map((name) => (
                      <th key={name} className="py-2 pr-4">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedExec).map(([day, row]) => (
                    <tr
                      key={day}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 font-semibold">{day}</td>
                      {execNames.map((name) => (
                        <td key={name} className="py-2 pr-4">
                          {(row as any)[name]?.join(" • ") || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Majority + next + ask to flex */}
        <section className="space-y-3">
          {/* Majority */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-blue-900">
              Majority 60-min window
            </h2>
            {majoritySlot ? (
              <div className="mt-2 space-y-1">
                {(() => {
                  const { dateLabel, timeLabel } = formatDateRange(
                    majoritySlot.start,
                    majoritySlot.end
                  );
                  return (
                    <>
                      <div className="text-sm font-semibold text-blue-900">
                        {dateLabel} {timeLabel}
                      </div>
                      <div className="text-xs text-blue-800">
                        Aligned execs ({majoritySlot.execs.length}):{" "}
                        {majoritySlot.execs.join(", ")}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-2 text-sm text-blue-900">
                No common 60-min window found yet.
              </div>
            )}
          </div>

          {/* Next possible windows */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-2 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Next possible windows
            </h2>
            {nextSlots && nextSlots.length > 0 ? (
              <div className="space-y-2">
                {nextSlots.map((slot, idx) => {
                  const { dateLabel, timeLabel } = formatDateRange(
                    slot.start,
                    slot.end
                  );
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {dateLabel} {timeLabel}
                      </div>
                      <div className="text-xs text-slate-600">
                        Aligned execs ({slot.execs.length}):{" "}
                        {slot.execs.join(", ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                No additional strong windows yet.
              </div>
            )}
          </div>

          {/* Ask to flex */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-amber-900">
              Ask to flex
            </h2>
            {majoritySlot && askToFlex.length > 0 ? (
              <div className="mt-2 text-sm text-amber-900">
                Ask these execs if they can flex around the majority window:{" "}
                <span className="font-medium">{askToFlex.join(", ")}</span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-amber-900">
                — All execs are aligned for the majority window.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

