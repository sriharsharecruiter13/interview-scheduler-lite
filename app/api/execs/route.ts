import { NextResponse } from "next/server";
import { getExecHistoryEntries } from "../../../lib/store";

export const runtime = "nodejs";

export async function GET() {
  // Returns an array like:
  // [{ execName, ranges: [{start,end}...], at }, ...]
  const history = await getExecHistoryEntries();
  return NextResponse.json(history);
}

