import { NextResponse } from "next/server";
import { getExecHistoryEntries } from "../../../lib/store";

export const runtime = "nodejs";

type Range = { start: string; end: string };

type ExecEntry = {
  execName: string;
  ranges: Range[];
  lastSubmittedAt?: string;
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
  // sort by start time
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return out;
}

export async function GET() {
  const entries = await getExecHistoryEntries();

  const map = new Map<string, { ranges: Range[]; lastAt: string }>();

  for (const e of entries || []) {
    if (!e?.execName) continue;
    if (!map.has(e.execName)) map.set(e.execName, { ranges: [], lastAt: e.at || "" });

    const bucket = map.get(e.execName)!;
    if (e.at && (!bucket.lastAt || new Date(e.at) > new Date(bucket.lastAt))) {
      bucket.lastAt = e.at;
    }

    for (const r of e.ranges || []) {
      if (r.start && r.end) bucket.ranges.push({ start: r.start, end: r.end });
    }
  }

  const execs: ExecEntry[] = Array.from(map.entries())
    .map(([execName, v]) => ({
      execName,
      ranges: dedupeRanges(v.ranges),
      lastSubmittedAt: v.lastAt || undefined,
    }))
    .sort((a, b) => a.execName.localeCompare(b.execName));

  return NextResponse.json(execs);
}

