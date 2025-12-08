import { NextResponse } from 'next/server';
import {
  addSubmission,
  getSubmissions,
  addExecHistoryEntry,
} from '../../../../lib/store';

type EaRange = { start: string; end: string };

export async function POST(req: Request) {
  try {
    const { execName, ranges = [] } = await req.json();

    const clean: EaRange[] = Array.isArray(ranges)
      ? ranges
          .filter((r: any) => r?.start && r?.end)
          .map((r: any) => ({ start: String(r.start), end: String(r.end) }))
          .filter((r) => new Date(r.end) > new Date(r.start))
      : [];

    if (!execName || clean.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Enter Exec name and at least one valid time range.',
        },
        { status: 400 },
      );
    }

    const at = new Date().toISOString();

    // 1) Existing behavior: store submission for the current scheduling window
    await addSubmission({ execName, ranges: clean, at } as any);

    // 2) New behavior: also append to global exec history log
    await addExecHistoryEntry({ execName, ranges: clean, at });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'failed' },
      { status: 500 },
    );
  }
}

export async function GET() {
  // keeps existing behavior if anything in your app calls this
  const submissions = await getSubmissions();
  return NextResponse.json({ submissions });
}

