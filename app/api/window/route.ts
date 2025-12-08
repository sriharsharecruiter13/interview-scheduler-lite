import { NextResponse } from "next/server";
import { db, makeId } from "../../../lib/db";
import { saveWindow, getWindow, getSubmissions } from "../../../lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) as any;

  const {
    candidateName,
    title,
    candidateRanges = [],
    eaDirectory = [],
    execList = "",
  } = body;

  const win: any = {
    candidateName,
    title,
    candidateRanges,
    eaDirectory,
    execList, // 👈 NEW: list / notes of execs for this request
    id: makeId(),
    createdAt: new Date().toISOString(),
  };

  await saveWindow(win);

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const base = `${proto}://${host}`.replace(/\/+$/, "");

  return NextResponse.json({
    ok: true,
    eaLink: `${base}/respond`,
    dashboard: `${base}/dashboard`,
  });
}

export async function GET() {
  const window = await getWindow();
  const submissions = await getSubmissions();
  return NextResponse.json({ window, submissions });
}

