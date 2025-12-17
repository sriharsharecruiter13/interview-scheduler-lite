k"use client";

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

type UIRange = {
  date: string; // YYYY-MM-DD
  start: string; // HH:MM (24h)
  end: string; // HH:MM (24h)
};

function toISO(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function uiRowToRange(r: UIRange): Range | null {
  if (!r.date || !r.start || !r.end) return null;
  const startISO = toISO(r.date, r.start);
  const endISO = toISO(r.date, r.end);
  if (!startISO || !endISO) return null;
  if (new Date(endISO) <= new Date(startISO)) return null;
  return { start: startISO, end: endISO };
}

// Helpers for parsing pasted rows from Google Sheets
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function Respond() {
  const [execName, setExecName] = useState("");
  const [rows, setRows] = useState<UIRange[]>([{ date: "", start: "", end: "" }]);
  const [candidateRanges, setCandidateRanges] = useState<Range[]>([]);
  const [execList, setExecList] = useState("");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  // Paste-from-sheet state
  const [pasteText, setPasteText] = useState("");
  const [pasteErr, setPasteErr] = useState("");

  const timeOptions = useMemo(() => {
    return [];
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

  function updateRow(idx: number, key: keyof UIRange, value: string) {
    setRows((list) =>
      list.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }

  function addRow() {
    setRows((list) => [...list, { date: "", start: "", end: "" }]);
  }

  function removeRow(i: number) {
    setRows((list) => list.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setErr("");
    setDone("");
    try {
      const clean: Range[] = rows
        .map(uiRowToRange)
        .filter((r): r is Range => !!r);

      if (!execName) throw new Error("Enter Exec name.");
      if (clean.length === 0)
        throw new Error("Add at least one valid time range.");

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
      setRows([{ date: "", start: "", end: "" }]);
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

  // Parse pasted text (expected format: Date, Start, End in 3 columns)
  function handleConvertPaste() {
    setPasteErr("");
    const text = pasteText.trim();
    if (!text) {
      setPasteErr("Paste rows from your sheet first.");
      return;
    }

    const lines = text.split(/\r?\n/);
    const newRows: UIRange[] = [];
    const errors: string[] = [];

    lines.forEach((line, idx) => {
      const raw = line.trim();
      if (!raw) return;

      const parts = raw.split("\t");
      if (parts.length < 3) {
        errors.push(`Line ${idx + 1}: expected at least 3 columns (Date, Start, End).`);
        return;
      }

      const dateStr = parts[0].trim();
      const startStr = parts[1].trim();
      const endStr = parts[2].trim();

      const startDate = new Date(`${dateStr} ${startStr}`);
      const endDate = new Date(`${dateStr} ${endStr}`);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push(
          `Line ${idx + 1}: could not parse date/time. Make sure format is like "12/16/2025    9:00 AM    10:30 AM".`
        );
        return;
      }

      if (endDate <= startDate) {
        errors.push(`Line ${idx + 1}: end time must be after start time.`);
        return;
      }

      const dateInput = toDateInputValue(startDate);
      const startInput = toTimeInputValue(startDate);
      const endInput = toTimeInputValue(endDate);

      newRows.push({
        date: dateInput,
        start: startInput,
        end: endInput,
      });
    });

    if (errors.length > 0) {
      setPasteErr(errors.join(" "));
    }

    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="ea" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec availability submission</h1>
          <p className="text-sm text-slate-600">
            Either type directly in the table, or copy 3 columns from your Google Sheet
            (Date, Start, End) and paste below. We&apos;ll convert them into time slots.
          </p>
        </header>

        <section className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Candidate availability + exec list */}
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
                    Email addresses are hidden on this page. If you support multiple execs from
                    this panel, submit availability separately for each exec by changing the Exec
                    name field below.
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
                        <td className="py-2 pr-4 whitespace-nowrap font-semibold">
                          {day}
                        </td>
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

          {/* Exec name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Exec name</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              value={execName}
              onChange={(e) => setExecName(e.target.value)}
              placeholder="Exec full name"
            />
          </div>

          {/* Paste-from-sheet helper */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-800">
              Paste from Google Sheet (optional)
            </div>
            <p className="text-[11px] text-slate-600">
              In your sheet, use 3 columns: Date, Start, End. Select rows, copy, then paste here.
              Example row:{" "}
              <em>12/16/2025&nbsp;&nbsp;&nbsp;9:00 AM&nbsp;&nbsp;&nbsp;10:30 AM</em>
            </p>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 font-mono"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"12/16/2025\t9:00 AM\t10:30 AM\n12/17/2025\t1:00 PM\t3:00 PM"}
            />
            <button
              type="button"
              onClick={handleConvertPaste}
              className="text-xs px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
            >
              Convert &amp; add to table
            </button>
            {pasteErr && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-800">
                {pasteErr}
              </div>
            )}
          </div>

          {/* Time ranges table */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">
              Exec time ranges (one row per slot)
            </label>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">
                        <input
                          type="date"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          value={r.date}
                          onChange={(e) => updateRow(i, "date", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="time"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          value={r.start}
                          onChange={(e) => updateRow(i, "start", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="time"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          value={r.end}
                          onChange={(e) => updateRow(i, "end", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          className="text-xs text-red-500"
                          onClick={() => removeRow(i)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="text-xs text-sky-600 hover:text-sky-500"
              type="button"
              onClick={addRow}
            >
              + Add another row
            </button>
          </div>

          {/* Buttons */}
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

        {/* Shared chat for TAC + EA */}
        <ChatPanel role="ea" />
      </div>
    </main>
  );
}

