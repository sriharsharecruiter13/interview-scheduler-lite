import { NextResponse } from "next/server";
import {
  upsertSubmission,
  removeSubmission,
  addExecHistoryEntry,
  getWindow,
} from "../../../../lib/store";

type Range = { start: string; end: string };

export const runtime = "nodejs";

function normExecName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeRanges(ranges: any[]): Range[] {
  if (!Array.isArray(ranges)) return [];

  // accept BOTH shapes:
  // 1) { start, end }
  // 2) { startISO, endISO }
  const out: Range[] = [];
  for (const r of ranges) {
    const start = r?.start ?? r?.startISO;
    const end = r?.end ?? r?.endISO;
    if (!start || !end) continue;

    const s = String(start);
    const e = String(end);

    const ds = new Date(s);
    const de = new Date(e);
    if (isNaN(ds.getTime()) || isNaN(de.getTime())) continue;
    if (de <= ds) continue;

    out.push({ start: s, end: e });
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const execName = normExecName(body?.execName);
    const cleanRanges = normalizeRanges(body?.ranges || []);

    if (!execName || cleanRanges.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Enter Exec name and at least one valid time range." },
        { status: 400 }
      );
    }

    const at = new Date().toISOString();

    // 1) Update CURRENT availability (latest per exec for current candidate)
    await upsertSubmission({ execName, ranges: cleanRanges, at } as any);

    // 2) Append to HISTORY log (cross-window)
    const win = await getWindow();
    await addExecHistoryEntry({
      execName,
      ranges: cleanRanges,
      at,
      candidateName: (win as any)?.candidateName,
      title: (win as any)?.title,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const execName = normExecName(body?.execName);

    if (!execName) {
      return NextResponse.json(
        { ok: false, error: "Enter Exec name to remove." },
        { status: 400 }
      );
    }

    await removeSubmission(execName);

    // History is an audit log — we do NOT delete rows when removing current.
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed" },
      { status: 500 }
    );
  }
}

