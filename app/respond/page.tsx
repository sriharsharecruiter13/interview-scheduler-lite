"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";

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
  date: string;
  startChoice: "dropdown" | "custom";
  endChoice: "dropdown" | "custom";
  startDropdown: string;
  endDropdown: string;
  startCustom: string;
  endCustom: string;
};

function buildTimeOptions(fromHour = 7, toHour = 20): string[] {
  const opts: string[] = [];
  for (let h = fromHour; h <= toHour; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
}

function toISO(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function uiRowToRange(r: UIRange): Range | null {
  const startTime =
    r.startChoice === "dropdown" ? r.startDropdown : r.startCustom;
  const endTime =
    r.endChoice === "dropdown" ? r.endDropdown : r.endCustom;
  const startISO = toISO(r.date, startTime);
  const endISO = toISO(r.date, endTime);
  if (!startISO || !endISO) return null;
  if (new Date(endISO) <= new Date(startISO)) return null;
  return { start: startISO, end: endISO };
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Respond() {
  const [execName, setExecName] = useState("");
  const [rows, setRows] = useState<UIRange[]>([
    {
      date: "",
      startChoice: "dropdown",
      endChoice: "dropdown",
      startDropdown: "",
      endDropdown: "",
      startCustom: "",
      endCustom: "",
    },
  ]);
  const [candidateRanges, setCandidateRanges] = useState<Range[]>([]);
  const [execList, setExecList] = useState("");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  // Quick pattern state
  const [patternStartDate, setPatternStartDate] = useState("");
  const [patternEndDate, setPatternEndDate] = useState("");
  const [patternDays, setPatternDays] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]); // Sun..Sat
  const [patternStartTime, setPatternStartTime] = useState("");
  const [patternEndTime, setPatternEndTime] = useState("");
  const [patternErr, setPatternErr] = useState("");

  const timeOptions = useMemo(() => buildTimeOptions(), []);

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

  function updateRow<K extends keyof UIRange>(
    idx: number,
    key: K,
    value: UIRange[K]
  ) {
    setRows((list) =>
      list.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }

  function addRow() {
    setRows((list) => [
      ...list,
      {
        date: "",
        startChoice: "dropdown",
        endChoice: "dropdown",
        startDropdown: "",
        endDropdown: "",
        startCustom: "",
        endCustom: "",
      },
    ]);
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
      setRows([
        {
          date: "",
          startChoice: "dropdown",
          endChoice: "dropdown",
          startDropdown: "",
          endDropdown: "",
          startCustom: "",
          endCustom: "",
        },
      ]);
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

  // QUICK PATTERN: generate ranges for a date range + selected weekdays
  function handleToggleDay(idx: number) {
    setPatternDays((prev) =>
      prev.map((val, i) => (i === idx ? !val : val))
    );
  }

  function generatePatternRanges() {
    setPatternErr("");
    // basic validation
    if (!patternStartDate || !patternEndDate) {
      setPatternErr("Choose both a start date and an end date.");
      return;
    }
    const start = new Date(patternStartDate);
    const end = new Date(patternEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setPatternErr("Invalid date range.");
      return;
    }
    if (end < start) {
      setPatternErr("End date should be on or after start date.");
      return;
    }
    if (!patternDays.some(Boolean)) {
      setPatternErr("Select at least one day of the week.");
      return;
    }
    if (!patternStartTime || !patternEndTime) {
      setPatternErr("Enter both start time and end time.");
      return;
    }
    if (patternEndTime <= patternStartTime) {
      setPatternErr("End time must be after start time.");
      return;
    }

    const newRows: UIRange[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dayIdx = cursor.getDay(); // 0=Sun..6=Sat
      if (patternDays[dayIdx]) {
        const dateStr = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
        newRows.push({
          date: dateStr,
          startChoice: "dropdown",
          endChoice: "dropdown",
          startDropdown: patternStartTime,
          endDropdown: patternEndTime,
          startCustom: "",
          endCustom: "",
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (newRows.length === 0) {
      setPatternErr(
        "No dates matched that combination. Check your dates and days of week."
      );
      return;
    }

    setRows((prev) => [...prev, ...newRows]);
    setPatternErr("");
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
            Pick a date and 30-min slot, or use the quick pattern tool to fill
            multiple days in one go (e.g. 2 weeks of Mon–Thu, 9–11 AM).
          </p>
        </header>

        <section className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Candidate availability + exec list */}
          {(candidateRanges.length > 0 || execListNamesOnly) && (
            <div className="space-y-3">
              {candidateRanges.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    Candidate availability:
                  </div>
                  <ul className="ml-4 text-sm text-slate-800">
                    {candidateRanges.map((r, i) => (
                      <li key={i}>{humanRangeLocal(r.start, r.end)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {execListNamesOnly && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    Execs for this request:
                  </div>
                  <pre className="text-sm text-slate-800 whitespace-pre-wrap rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
                    {execListNamesOnly}
                  </pre>
                  <p className="text-[11px] text-slate-500">
                    Email addresses are hidden on this page. If you support
                    multiple execs from this panel, submit availability
                    separately for each exec by changing the Exec name field
                    below.
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
            <label className="text-sm font-medium text-slate-800">
              Exec name
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              value={execName}
              onChange={(e) => setExecName(e.target.value)}
              placeholder="Exec full name"
            />
          </div>

          {/* QUICK PATTERN GENERATOR */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Quick pattern (optional)
                </div>
                <p className="text-[11px] text-slate-600">
                  Use this to generate repeated availability over multiple days
                  (e.g. next 2 weeks, Mon–Thu, 9–11 AM). Generated rows appear
                  in the list below and can be edited or removed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Date range */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Start date</div>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={patternStartDate}
                  onChange={(e) => setPatternStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">End date</div>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={patternEndDate}
                  onChange={(e) => setPatternEndDate(e.target.value)}
                />
              </div>

              {/* Days of week */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Days of week</div>
                <div className="flex flex-wrap gap-1">
                  {weekdayLabels.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleToggleDay(idx)}
                      className={
                        "text-[11px] px-2 py-1 rounded-full border " +
                        (patternDays[idx]
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white text-slate-700 border-slate-300")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Start time</div>
                <input
                  type="time"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={patternStartTime}
                  onChange={(e) => setPatternStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">End time</div>
                <input
                  type="time"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={patternEndTime}
                  onChange={(e) => setPatternEndTime(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={generatePatternRanges}
                  className="text-xs px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                >
                  Generate ranges
                </button>
              </div>
            </div>

            {patternErr && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-800">
                {patternErr}
              </div>
            )}
          </div>

          {/* Time ranges (manual + generated) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">
              Add exec time ranges (date + 30-min dropdown or custom times)
            </label>
            {rows.map((r, i) => (
              <div
                key={i}
                className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50"
              >
                {/* Date */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-col flex-1">
                    <span className="text-xs text-slate-500 mb-1">Date</span>
                    <input
                      type="date"
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                      value={r.date}
                      onChange={(e) => updateRow(i, "date", e.target.value)}
                    />
                  </div>
                </div>

                {/* Start / End */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Start */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Start time</span>
                      <button
                        type="button"
                        className="text-[11px] text-sky-600"
                        onClick={() =>
                          updateRow(
                            i,
                            "startChoice",
                            r.startChoice === "dropdown" ? "custom" : "dropdown"
                          )
                        }
                      >
                        {r.startChoice === "dropdown"
                          ? "Use custom"
                          : "Use dropdown"}
                      </button>
                    </div>
                    {r.startChoice === "dropdown" ? (
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        value={r.startDropdown}
                        onChange={(e) =>
                          updateRow(i, "startDropdown", e.target.value)
                        }
                      >
                        <option value="">Select…</option>
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="time"
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        value={r.startCustom}
                        onChange={(e) =>
                          updateRow(i, "startCustom", e.target.value)
                        }
                      />
                    )}
                  </div>

                  {/* End */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">End time</span>
                      <button
                        type="button"
                        className="text-[11px] text-sky-600"
                        onClick={() =>
                          updateRow(
                            i,
                            "endChoice",
                            r.endChoice === "dropdown" ? "custom" : "dropdown"
                          )
                        }
                      >
                        {r.endChoice === "dropdown"
                          ? "Use custom"
                          : "Use dropdown"}
                      </button>
                    </div>
                    {r.endChoice === "dropdown" ? (
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        value={r.endDropdown}
                        onChange={(e) =>
                          updateRow(i, "endDropdown", e.target.value)
                        }
                      >
                        <option value="">Select…</option>
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="time"
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        value={r.endCustom}
                        onChange={(e) =>
                          updateRow(i, "endCustom", e.target.value)
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => removeRow(i)}
                  >
                    Remove range
                  </button>
                </div>
              </div>
            ))}
            <button
              className="text-xs text-sky-600 hover:text-sky-500"
              type="button"
              onClick={addRow}
            >
              Add another range
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
      </div>
    </main>
  );
}

