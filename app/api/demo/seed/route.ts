import { NextResponse } from "next/server";
import { makeId } from "../../../../lib/db";
import { saveWindow, upsertSubmission, addExecHistoryEntry } from "../../../../lib/store";

export const runtime = "nodejs";

function iso(y: number, m: number, d: number, h: number, min: number) {
  const dt = new Date(y, m - 1, d, h, min, 0, 0);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${hh}:${mi}`;
}

export async function POST() {
  const at = new Date().toISOString();

  const win = {
    id: makeId(),
    candidateName: "Demo Candidate",
    title: "Demo Role",
    execList: "Cathy\nJon\nNiall",
    candidateRanges: [
      { start: iso(2026, 1, 16, 8, 0), end: iso(2026, 1, 16, 13, 30) },
      { start: iso(2026, 1, 17, 9, 0), end: iso(2026, 1, 17, 12, 0) },
    ],
    eaDirectory: [],
  } as any;

  await saveWindow(win);

  // Seed current submissions + history rows
  const seed = async (execName: string, ranges: any[]) => {
    await upsertSubmission({ execName, ranges, at } as any);
    await addExecHistoryEntry({
      execName,
      ranges,
      at,
      candidateName: win.candidateName,
      title: win.title,
    });
  };

  await seed("Cathy", [
    { start: iso(2026, 1, 16, 9, 0), end: iso(2026, 1, 16, 11, 0) },
    { start: iso(2026, 1, 17, 10, 0), end: iso(2026, 1, 17, 11, 0) },
  ]);

  await seed("Jon", [{ start: iso(2026, 1, 16, 10, 0), end: iso(2026, 1, 16, 12, 0) }]);

  await seed("Niall", [{ start: iso(2026, 1, 17, 9, 0), end: iso(2026, 1, 17, 11, 0) }]);

  return NextResponse.json({ ok: true });
}

