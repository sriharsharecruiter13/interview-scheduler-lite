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
    const map: Record<string, Recor

