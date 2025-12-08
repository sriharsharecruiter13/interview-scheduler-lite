"use client";

import { useEffect, useMemo, useState } from "react";

type Range = { start: string; end: string };

type Submission = {
  execName: string;
  ranges: Range[];
  at?: string;
};

type WindowResponse = {
  window?: {
    candidateName?: string;
    candidateTitle?: string;
    candidateRanges?: Range[];
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

// check if [start,end] is fully within any of the ranges
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

  // overall candidate window min/max
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

    // ensure candidate is free for full window
    if (!isCovered(candidateRanges, s, e)) continue;

    // which execs are fully available in this window?
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
  const candidateTitle = data?.window?.candidateTitle ?? "";
  const candidateRanges = data?.window?.candidateRanges ?? [];
  const submissions = data?.submissions ?? [];

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

    // sort by #execs desc, then by start asc
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
      .filter((s) => s.execs.length >= Math.max(2, maxExecs - 1)); // "next possible"

    const allExecNames = Array.from(
      new Set(submissions.map((s) => s.execName))
    );
    const askToFlex = allExecNames.filter(
      (name) => !majoritySlot.execs.includes(name)
    );

    return { majoritySlot, nextSlots, askToFlex };
  }, [candidateRanges, submissions]);

  const groupedExec = useMemo(() => {
    // For "Exec availability so far (grouped by day)" section
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
    <main className="min-h-screen bg-[#050816] text-zinc-50 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Logo row — assuming you already have logo + nav elsewhere in layout;
            if not, you can add nav here too */}
        <div className="flex justify-end mb-2">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        {/* Page header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            Live view of EA submissions and common 60-min windows for this
            candidate.
          </p>
        </header>

        {/* Candidate card */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Candidate
              </div>
              <div className="text-lg font-semibold">{candidateName}</div>
              {candidateTitle && (
                <div className="text-sm text-zinc-300">{candidateTitle}</div>
              )}
              <div className="mt-3 text-sm font-semibold">
                Candidate availability
              </div>
              <div className="text-sm text-zinc-200">
                {candidateWindowLabel}
              </div>
            </div>
          </div>
        </section>

        {/* EA submissions table (like you already had) */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:p-5 space-y-3">
          <h2 className="text-lg font-semibold">EA submissions</h2>
          {submissions.length === 0 ? (
            <div className="text-sm text-zinc-400">
              No EA submissions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
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
                      className="border-b border-zinc-900 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {s.execName}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-zinc-400 text-xs">
                        {s.at
                          ? new Date(s.at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-zinc-200">
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

        {/* Exec availability grouped by day (like old white dashboard) */}
        {Object.keys(groupedExec).length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:p-5 space-y-3">
            <h2 className="text-lg font-semibold">
              Exec availability so far (grouped by day)
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
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
                  {Object.entries(groupedExec).map(
                    ([day, row]) => (
                      <tr
                        key={day}
                        className="border-b border-zinc-900 last:border-0"
                      >
                        <td className="py-2 pr-4 font-semibold">
                          {day}
                        </td>
                        {execNames.map((name) => (
                          <td key={name} className="py-2 pr-4">
                            {(row as any)[name]?.join(" • ") ||
                              "—"}
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Majority 60-min window */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-blue-900/60 bg-blue-950/40 p-4 md:p-5">
            <h2 className="text-sm font-semibold text-blue-200">
              Majority 60-min window
            </h2>
            {majoritySlot ? (
              (() => {
                const { dateLabel, timeLabel } = formatDateRange(
                  majoritySlot.start,
                  majoritySlot.end
                );
                return (
                  <div className="mt-2 space-y-1">
                    <div className="text-sm font-semibold">
                      {dateLabel} {timeLabel}
                    </div>
                    <div className="text-xs text-blue-200">
                      Aligned execs ({majoritySlot.execs.length}):{" "}
                      {majoritySlot.execs.join(", ")}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mt-2 text-sm text-blue-100">
                No common 60-min window found yet.
              </div>
            )}
          </div>

          {/* Next possible windows */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:p-5 space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">
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
                      className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2"
                    >
                      <div className="text-sm font-medium">
                        {dateLabel} {timeLabel}
                      </div>
                      <div className="text-xs text-zinc-400">
                        Aligned execs ({slot.execs.length}):{" "}
                        {slot.execs.join(", ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">
                No additional strong windows yet.
              </div>
            )}
          </div>

          {/* Ask to flex */}
          <div className="rounded-2xl border border-amber-700/60 bg-amber-950/40 p-4 md:p-5">
            <h2 className="text-sm font-semibold text-amber-200">
              Ask to flex
            </h2>
            {majoritySlot && askToFlex.length > 0 ? (
              <div className="mt-2 text-sm text-amber-100">
                Ask these execs if they can flex around the majority
                window:{" "}
                <span className="font-medium">
                  {askToFlex.join(", ")}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-amber-100">
                — All execs are aligned for the majority window.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

