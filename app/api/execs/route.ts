import { NextResponse } from "next/server";
import { getExecHistoryEntries } from "../../../lib/store";

export const runtime = "nodejs";

export async function GET() {
  const entries = await getExecHistoryEntries();

  // Return raw history rows (latest first) so TACs can see the "log"
  // Shape:
  // { id, execName, ranges:[{start,end}], at, candidateName?, title? }
  const out = (entries || [])
    .filter((e: any) => e?.execName && e?.ranges?.length)
    .map((e: any) => ({
      id: e.id,
      execName: e.execName,
      ranges: (e.ranges || [])
        .filter((r: any) => (r?.start || r?.startISO) && (r?.end || r?.endISO))
        .map((r: any) => ({
          start: String(r.start ?? r.startISO),
          end: String(r.end ?? r.endISO),
        })),
      at: e.at,
      candidateName: e.candidateName,
      title: e.title,
    }))
    .sort((a: any, b: any) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());

  return NextResponse.json(out);
}

