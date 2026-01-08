"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import ChatPanel from "@/components/ChatPanel";

type Range = { start: string; end: string };
type Submission = { execName: string; ranges: Range[]; at: string };

type WindowResponse = {
  window?: {
    candidateName?: string;
    title?: string;
    candidateRanges?: Range[];
    execList?: string;
  };
  submissions?: Submission[];
};

function humanRangeLocal(sISO: string, eISO: string) {
  const s = new Date(sISO);
  const e = new Date(eISO);
  const dFmt = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  });
  const tFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dFmt.format(s)} ${tFmt.format(s)} – ${tFmt.format(e)}`;
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

/** ---------- Manual text parsing helpers ---------- **/

// Accepts things like:
// "Jan 16 10AM-11:30AM; Jan 16 2:30PM-4PM; Jan 17 9AM-11AM"
// Also accepts commas/newlines as separators.
function splitEntries(text: string): string[] {
  return text
    .split(/[\n;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Normalize spaces and dashes
function normalizeEntry(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

// Parse a date prefix like "Jan 16" OR "Jan 16 2026" OR "1/16" OR "1/16/2026"
function parseDatePrefix(s: string): { date: Date; rest: string } | null {
  const t = s.trim();

  // 1) Month name formats: "Jan 16" or "Jan 16 2026"
  {
    const m = t.match(
      /^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?\s+(.*)$/i
    );
    if (m) {
      const monRaw = (m[1] || "").toLowerCase();
      const day = Number(m[2]);
      const year = m[3] ? Number(m[3]) : new Date().getFullYear();
      const mon = MONTHS[monRaw];
      if (mon === undefined) return null;
      const d = new Date(year, mon, day, 0, 0, 0, 0);
      if (isNaN(d.getTime())) return null;
      return { date: d, rest: (m[4] || "").trim() };
    }
  }

  // 2) Numeric formats: "1/16 10AM-11AM" or "01/16/2026 10:00-11:00"
  {
    const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(.*)$/);
    if (m) {
      const mon = Number(m[1]) - 1;
      const day = Number(m[2]);
      let year = new Date().getFullYear();
      if (m[3]) {
        const y = Number(m[3]);
        year = y < 100 ? 2000 + y : y;
      }
      const d = new Date(year, mon, day, 0, 0, 0, 0);
      if (isNaN(d.getTime())) return null;
      return { date: d, rest: (m[4] || "").trim() };
    }
  }

  return null;
}

// Parse time token like "10AM", "11:30am", "14:00", "2:30PM"
function parseTimeToken(token: string): { hours: number; minutes: number } | null {
  const t = token.trim().toLowerCase().replace(/\./g, "");

  // 24h "14:30" or "14"
  const m24 = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
  const hasAmPm = /am|pm$/.test(t);

  if (!hasAmPm && m24) {
    const hh = Number(m24[1]);
    const mm = m24[2] ? Number(m24[2]) : 0;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hours: hh, minutes: mm };
  }

  // 12h "10am" "10:30pm"
  const m12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let hh = Number(m12[1]);
    const mm = m12[2] ? Number(m12[2]) : 0;
    const ap = m12[3];
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (ap === "am") {
      if (hh === 12) hh = 0;
    } else {
      if (hh !== 12) hh += 12;
    }
    return { hours: hh, minutes: mm };
  }

  return null;
}

function toISOForLocal(date: Date): string {
  // This keeps local time without forcing Z; your app currently uses local ISO-like strings
  // e.g. "2026-01-16T10:00"
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

// Parse one entry like: "Jan 16 10AM-11:30AM"
function parseOneManualEntry(entry: string): { range: Range | null; error?: string } {
  const normalized = normalizeEntry(entry);

  const dp = parseDatePrefix(normalized);
  if (!dp) return { range: null, error: `Could not read date in: "${entry}"` };

  const { date, rest } = dp;

  // rest expected like "10AM-11:30AM"
  const parts = rest.split("-");
  if (parts.length !== 2) {
    return { range: null, error: `Expected "start-end" after date in: "${entry}"` };
  }

  const startTok = parts[0].trim();
  const endTok = parts[1].trim();

  const st = parseTimeToken(startTok);
  const en = parseTimeToken(endTok);
  if (!st || !en) {
    return { range: null, error: `Could not read time in: "${entry}"` };
  }

  const start = new Date(date);
  start.setHours(st.hours, st.minutes, 0, 0);

  const end = new Date(date);
  end.setHours(en.hours, en.minutes, 0, 0);

  if (end <= start) {
    return { range: null, error: `End must be after start in: "${entry}"` };
  }

  return {
    range: { start: toISOForLocal(start), end: toISOForLocal(end) },
  };
}

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

/** ---------- Component ---------- **/

export default function Respond() {
  const [execName, setExecName] = useState("");
  const [candidateRanges, setCandidateRanges] = useState<Range[]>([]);
  const [execList, setExecList] = useState("");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  // Manual entry + preview
  const [manualText, setManualText] = useState("");
  const [preview, setPreview] = useState<Range[]>([]);
  const [manualErr, setManualErr] = useState<string>("");

  async function load() {
    const r = await fetch(`/api/window`);
    const d = (await r.json()) as WindowResponse;
    setCandidateRanges(d?.window?.candidateRanges || []);
    setExecList(d?.window?.execList || "");
    setSubs(d?.submissions || []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // names-only version of execList (no emails) for EA view
  const execListNamesOnly = useMemo(() => {
    if (!execList) return "";
    return execList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[-–—]/);
        return (parts[0] || "").trim();
      })
      .filter(Boolean)
      .join("\n");
  }, [execList]);

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const s of subs) {
      for (const r of s.ranges || []) {
        const day = dayKey(r.start);
        map[day] ||= {};
        map[day][s.execName] ||= [];
        const tf = (x: string) =>
          new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(x));
        map[day][s.execName].push(`${tf(r.start)}–${tf(r.end)}`);
      }
    }
    return map;
  }, [subs]);

  const execColumns = Array.from(new Set(subs.map((s) => s.execName)));

  function convertManualToPreview() {
    setManualErr("");
    const txt = manualText.trim();
    if (!txt) {
      setManualErr("Enter at least one availability line.");
      setPreview([]);
      return;
    }

    const entries = splitEntries(txt);
    const errors: string[] = [];
    const ranges: Range[] = [];

    for (const e of entries) {
      const parsed = parseOneManualEntry(e);
      if (parsed.range) ranges.push(parsed.range);
      else if (parsed.error) errors.push(parsed.error);
    }

    const clean = dedupeRanges(ranges);

    if (errors.length) {
      setManualErr(errors.slice(0, 6).join(" | "));
    }

    setPreview(clean);
  }

  async function submit() {
    setErr("");
    setDone("");
    try {
      if (!execName) throw new Error("Enter Exec name.");

      const clean = preview.length ? preview : [];
      if (clean.length === 0) {
        throw new Error(
          "No ranges to save yet. Paste/type availability then click “Convert to preview”."
        );
      }

      const res = await fetch("/api/ea/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execName, ranges: clean }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Failed to save");
      }

      setDone("Saved. Your previous availability (if any) was replaced.");
      setManualText("");
      setPreview([]);
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  async function removeMine() {
    setErr("");
    setDone("");
    try {
      if (!execName) throw new Error("Enter Exec name to remove it.");

      const res = await fetch("/api/ea/submit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execName }),
      });

      if (!res.ok) throw new Error("Failed to remove");

      setDone("Removed your availability.");
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="ea" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec availability submission</h1>
          <p className="text-sm text-slate-600">
            Fast entry: type ranges like{" "}
            <span className="font-mono text-xs">
              Jan 16 10AM-11:30AM; Jan 16 2:30PM-4PM; Jan 17 9AM-11AM
            </span>{" "}
            then convert to preview and submit.
          </p>
        </header>

        <section className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {(candidateRanges.length > 0 || execListNamesOnly) && (
            <div className="space-y-3">
              {candidateRanges.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Candidate availability:</div>
                  <ul className="ml-4 text-sm text-slate-800">
                    {candidateRanges.map((r, i) => (
                      <li key={i}>{humanRangeLocal(r.start, r.end)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {execListNamesOnly && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Execs for this request:</div>
                  <pre className="text-sm text-slate-800 whitespace-pre-wrap rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
                    {execListNamesOnly}
                  </pre>
                  <p className="text-[11px] text-slate-500">
                    Email addresses are hidden on this page. If you support multiple execs, submit separately per exec name.
                  </p>
                </div>
              )}
            </div>
          )}

          {execColumns.length > 0 && Object.keys(grouped).length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                Exec availability so far (grouped by day)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left py-2 pr-4">Date</th>
                      {execColumns.map((name) => (
                        <th key={name} className="text-left py-2 pr-4">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(grouped).map(([day, row]) => (
                      <tr key={day} className="border-b border-slate-100">
                        <td className="py-2 pr-4 whitespace-nowrap font-semibold">{day}</td>
                        {execColumns.map((name) => (
                          <td key={name} className="py-2 pr-4">
                            {(row as any)[name]?.join(", ") || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Exec name</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              value={execName}
              onChange={(e) => setExecName(e.target.value)}
              placeholder="Exec full name"
            />
          </div>

          {/* Manual entry */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-800">
              Enter availability manually
            </div>
            <p className="text-[11px] text-slate-600">
              One per line (or separate with semicolons). Supported date formats:{" "}
              <span className="font-mono">Jan 16</span>,{" "}
              <span className="font-mono">Jan 16 2026</span>,{" "}
              <span className="font-mono">1/16</span>,{" "}
              <span className="font-mono">1/16/2026</span>. Times:{" "}
              <span className="font-mono">10AM</span>,{" "}
              <span className="font-mono">11:30AM</span>,{" "}
              <span className="font-mono">14:00</span>.
            </p>

            <textarea
              className="w-full min-h-[110px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 font-mono"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={
                "Jan 16 10AM-11:30AM\nJan 16 2:30PM-4PM\nJan 17 9AM-11AM\nJan 17 1PM-3PM"
              }
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={convertManualToPreview}
                className="text-xs px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-slate-100"
              >
                Convert to preview
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualText("");
                  setPreview([]);
                  setManualErr("");
                }}
                className="text-xs px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            {manualErr && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                {manualErr}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-800">Preview</div>
            {preview.length === 0 ? (
              <div className="text-xs text-slate-500">
                Convert your manual entry to see preview rows here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Start</th>
                      <th className="py-2 pr-4">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={`${r.start}-${r.end}-${i}`} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 text-slate-800">{new Date(r.start).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-slate-800">{new Date(r.end).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              type="button"
              onClick={submit}
              disabled={!execName}
            >
              Save / Replace my availability
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-800"
              onClick={removeMine}
            >
              Remove my availability
            </button>
          </div>

          {done && (
            <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
              {done}
            </div>
          )}
          {err && (
            <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              {err}
            </div>
          )}
        </section>

        <ChatPanel role="ea" />
      </div>
    </main>
  );
}

