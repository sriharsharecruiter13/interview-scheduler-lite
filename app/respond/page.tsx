"use client";

import { useEffect, useMemo, useState } from "react";

type Range = { start: string; end: string };
type Submission = { execName: string; ranges: Range[]; at: string };

function humanRangeLocal(sISO: string, eISO: string) {
  const s = new Date(sISO),
    e = new Date(eISO);
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
  const [subs, setSubs] = useState<Submission[]>([]);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const timeOptions = useMemo(() => buildTimeOptions(), []);

  async function load() {
    const r = await fetch(`/api/window`);
    const d = await r.json();
    setCandidateRanges(d?.window?.candidateRanges || []);
    setSubs(d?.submissions || []);
  }
  async function loadAnalysis() {
    // keep to preserve existing behavior, but ignore analysis in UI
    try {
      await fetch("/api/agent/run").then((r) => r.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    loadAnalysis();
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      load();
      loadAnalysis();
    }, 10000);
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
      loadAnalysis();
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
      loadAnalysis();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  // group exec availability by day (for the table)
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        {/* Nav row */}
        <nav className="flex flex-wrap gap-2 items-center mb-4">
          <a
            href="/"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Scheduler
          </a>
          <a
            href="/respond"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-50 text-slate-900"
          >
            EA page
          </a>
          <a
            href="/dashboard"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dashboard
          </a>
          <a
            href="/candidates"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Candidate log
          </a>
          <a
            href="/execs"
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Exec availability
          </a>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">EA availability submission</h1>
          <p className="text-sm text-slate-400">
            Pick a date and 30-min slot, or choose “Custom” and type any time
            (e.g. 9:05 AM – 9:30 AM).
          </p>
        </header>

        <section className="space-y-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          {candidateRanges.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-semibold">Candidate availability:</div>
              <ul className="ml-4 text-sm">
                {candidateRanges.map((r, i) => (
                  <li key={i}>{humanRangeLocal(r.start, r.end)}</li>
                ))}
              </ul>
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
                    <tr className="border-b border-slate-800 text-slate-400">
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
                      <tr key={day} className="border-b border-slate-800/60">
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Exec name</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
              value={execName}
              onChange={(e) => setExecName(e.target.value)}
              placeholder="Exec full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Add exec time ranges (date + 30-min dropdown or custom times)
            </label>
            {rows.map((r, i) => (
              <div
                key={i}
                className="space-y-2 border border-slate-800 rounded-lg p-3"
              >
                {/* Date */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-col flex-1">
                    <span className="text-xs text-slate-400 mb-1">Date</span>
                    <input
                      type="date"
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
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
                      <span className="text-xs text-slate-400">Start time</span>
                      <button
                        type="button"
                        className="text-[11px] text-sky-400"
                        onClick={() =>
                          updateRow(
                            i,
                            "startChoice",
                            r.startChoice === "dropdown" ? "custom" : "dropdown"
                          )
                        }
                      >
                        {r.startChoice === "dropdown" ? "Use custom" : "Use dropdown"}
                      </button>
                    </div>
                    {r.startChoice === "dropdown" ? (
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
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
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
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
                      <span className="text-xs text-slate-400">End time</span>
                      <button
                        type="button"
                        className="text-[11px] text-sky-400"
                        onClick={() =>
                          updateRow(
                            i,
                            "endChoice",
                            r.endChoice === "dropdown" ? "custom" : "dropdown"
                          )
                        }
                      >
                        {r.endChoice === "dropdown" ? "Use custom" : "Use dropdown"}
                      </button>
                    </div>
                    {r.endChoice === "dropdown" ? (
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
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
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50"
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
                    className="text-xs text-red-400"
                    onClick={() => removeRow(i)}
                  >
                    Remove range
                  </button>
                </div>
              </div>
            ))}
            <button
              className="text-xs text-sky-400 hover:text-sky-300"
              type="button"
              onClick={addRow}
            >
              Add another range
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
              type="button"
              onClick={submit}
              disabled={!execName}
            >
              Save / Replace my availability
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-700 px-4 py-1.5 text-sm text-slate-200"
              onClick={removeMine}
            >
              Remove my availability
            </button>
          </div>

          {done && (
            <div className="mt-2 rounded-md bg-emerald-900/40 px-3 py-2 text-xs text-emerald-200">
              {done}
            </div>
          )}
          {err && (
            <div className="mt-2 rounded-md bg-red-900/40 px-3 py-2 text-xs text-red-200">
              {err}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

