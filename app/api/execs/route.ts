import { NextResponse } from 'next/server';
import { getSubmissions } from '../../../lib/store';

export const runtime = 'nodejs';

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

export async function GET() {
  // same submissions that /api/window returns
  const submissions: Submission[] = (await getSubmissions()) || [];

  const map = new Map<string, Range[]>();

  for (const s of submissions) {
    if (!s.execName) continue;
    if (!map.has(s.execName)) map.set(s.execName, []);
    const arr = map.get(s.execName)!;

    for (const r of s.ranges || []) {
      if (r.start && r.end) {
        arr.push({ start: r.start, end: r.end });
      }
    }
  }

  const execs: ExecEntry[] = Array.from(map.entries()).map(
    ([execName, ranges]) => ({
      execName,
      ranges,
    })
  );

  return NextResponse.json(execs);
}

