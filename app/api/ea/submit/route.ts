import { NextResponse } from "next/server";
import { upsertSubmission, removeSubmission } from "../../../../lib/store";

type Range = { start: string; end: string };

export const runtime = "nodejs";

function normExecName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  try {
    const { execName, ranges = [] } = await req.json();

    const cleanExec = normExecName(execName);

    const clean: Range[] = Array.isArray(ranges)
      ? ranges
          .filter((r: any) => r?.start && r?.end)
          .map((r: any) => ({ start: String(r.start), end: String(r.end) }))
          .filter((r) => new Date(r.end) > new Date(r.start))
      : [];

    if (!cleanExec || clean.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Enter Exec name and at least one valid time range." },
        { status: 400 }
      );
    }

    await upsertSubmission({
      execName: cleanExec,
      ranges: clean,
      at: new Date().toISOString(),
    } as any);

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
    const { execName } = await req.json();
    const cleanExec = normExecName(execName);
    if (!cleanExec) {
      return NextResponse.json(
        { ok: false, error: "Enter Exec name to remove." },
        { status: 400 }
      );
    }

    await removeSubmission(cleanExec);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed" },
      { status: 500 }
    );
  }
}

