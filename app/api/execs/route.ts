import { NextResponse } from "next/server";
import { getSubmissions } from "../../../lib/store";

export const runtime = "nodejs";

type Range = { start: string; end: string };

type Submission = {
  execName: string;
  ranges: Range[];
  at?: string;
};

type ExecEntry = {
  execName: string;
  ranges: Range[];
};

function dedupeRanges(ranges: Range[]): Range[] {
  const seen = new Set<string>();
  const out: Range[] = [];
  for (const r of ranges) {
    const key = `${r.start}|${r.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function GET() {
  const submissions: Submission[] = (await getSubmissions()) || [];

  // Already one submission per exec, but we’ll still aggregate safely
  const map = new Map<string, Range[]>();

  for (const s of submissions) {
    if (!s.execName) continue;
    if (!map.has(s.execName)) map.set(s.execName, []);
    const arr = map.get(s.execName)!;

    for (const r of s.ranges || []) {
      if (r.start && r.end) arr.push({ start: r.start, end: r.end });
    }
  }

  const execs: ExecEntry[] = Array.from(map.entries())
    .map(([execName, ranges]) => ({
      execName,
      ranges: dedupeRanges(ranges),
    }))
    .sort((a, b) => a.execName.localeCompare(b.execName));

  return NextResponse.json(execs);
}

