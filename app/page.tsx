"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";

type Range = { start: string; end: string };

type UIRange = {
  date: string;
  startChoice: "dropdown" | "custom";
  endChoice: "dropdown" | "custom";
  startDropdown: string;
  endDropdown: string;
  startCustom: string;
  endCustom: string;
};

type EAEntry = { email: string };

type WindowResponse = {
  ok?: boolean;
  eaLink?: string;
  dashboard?: string;
};

const CANDIDATE_LOG_KEY = "candidateLog";

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

function appendCandidateLog(entry: {
  candidateName: string;
  title: string;
  schedulerUrl?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CANDIDATE_LOG_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const createdAt = new Date().toISOString();

    list.push({
      id: `${entry.candidateName}-${createdAt}`,
      candidateName: entry.candidateName,
      title: entry.title,
      schedulerUrl: entry.schedulerUrl,
      createdAt,
    });

    window.localStorage.setItem(CANDIDATE_LOG_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export default function SchedulerPage() {
  const [candidateName, setCandidateName] = useState("");
  const [title, setTitle] = useState("");
  const [ranges, setRanges] = useState<UIRange[]>([
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
  const [eaList, setEaList] = useState<EAEntry[]>([{ email: "" }]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<{ eaLink?: string; dashboard?: string }>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeOptions = buildTimeOptions();

  function updateRange<K extends keyof UIRange>(
    idx: number,
    key: K,
    value: UIRange[K]
  ) {
    setRanges((list) =>
      list.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  }

  function addRange() {
    setRanges((list) => [
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

  function removeRange(idx: number) {
    setRanges((list) => list.filter((_, i) => i !== idx));
  }

  function updateEa(idx: number, email: string) {
    setEaList((list) => list.map((e, i) => (i === idx ? { email } : e)));
  }

  function addEaRow() {
    setEaList((list) => [...list, { email: "" }]);
  }

  function removeEaRow(idx: number) {
    setEaList((list) => list.filter((_, i) => i !== idx));
  }

  async function submit() {
    setStatus(null);
    setError(null);
    setLinks({});
    try {
      if (!candidateName.trim()) {
        throw new Error("Enter candidate name.");
      }

      const cleanRanges: Range[] = ranges
        .map(uiRowToRange)
        .filter((r): r is Range => !!r);

      if (cleanRanges.length === 0) {
        throw new Error("Add at least one valid candidate time range.");
      }

      const eaDirectory = eaList
        .map((e) => e.email.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      setIsSubmitting(true);

      const res = await fetch("/api/window", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName,
          title,
          candidateRanges: cleanRanges,
          eaDirectory,
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as WindowResponse;
        throw new Error((j as any)?.error || "Failed to create window");
      }

      const j = (await res.json()) as WindowResponse;
      setStatus("Scheduler window created.");
      setLinks({ eaLink: j.eaLink, dashboard: j.dashboard });

      appendCandidateLog({
        candidateName,
        title,
        schedulerUrl:
          typeof window !== "undefined" ? window.location.href : "",
      });
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="scheduler" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Exec Scheduling – Scheduler</h1>
          <p className="text-sm text-slate-600">
            Enter the candidate details and availability. EAs will submit exec
            availability against this window.
          </p>
        </header>

        <section className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Candidate info */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">
                  Candidate name
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="Candidate full name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">
                  Role / Title
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Role (e.g. VP Product)"
                />
              </div>
            </div>
          </div>

          {/* Candidate ranges */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">
              Candidate availability (date + 30-min dropdown or custom times)
            </label>
            {ranges.map((r, i) => (
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
                      onChange={(e) =>
                        updateRange(i, "date", e.target.value)
                      }
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
                          updateRange(
                            i,
                            "startChoice",
                            r.startChoice === "dropdown"
                              ? "custom"
                              : "dropdown"
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
                          updateRange(
                            i,
                            "startDropdown",
                            e.target.value
                          )
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
                          updateRange(
                            i,
                            "startCustom",
                            e.target.value
                          )
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
                          updateRange(
                            i,
                            "endChoice",
                            r.endChoice === "dropdown"
                              ? "custom"
                              : "dropdown"
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
                          updateRange(
                            i,
                            "endDropdown",
                            e.target.value
                          )
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
                          updateRange(
                            i,
                            "endCustom",
                            e.target.value
                          )
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => removeRange(i)}
                  >
                    Remove range
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-sky-600 hover:text-sky-500"
              onClick={addRange}
            >
              Add another range
            </button>
          </div>

          {/* EA directory */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">
              EA directory (optional – used to send EA links)
            </label>
            {eaList.map((ea, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <input
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  placeholder="EA email"
                  value={ea.email}
                  onChange={(e) => updateEa(idx, e.target.value)}
                />
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() => removeEaRow(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-sky-600 hover:text-sky-500"
              onClick={addEaRow}
            >
              Add another EA
            </button>
          </div>

          {/* Actions & status */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={submit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create window"}
            </button>

            {status && (
              <span className="text-xs text-emerald-600">{status}</span>
            )}
            {error && (
              <span className="text-xs text-red-600">{error}</span>
            )}
          </div>

          {/* Links */}
          {(links.eaLink || links.dashboard) && (
            <div className="mt-3 space-y-1 text-sm">
              {links.eaLink && (
                <div>
                  EA link:{" "}
                  <a
                    href={links.eaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 underline"
                  >
                    Open EA page
                  </a>
                </div>
              )}
              {links.dashboard && (
                <div>
                  Dashboard:{" "}
                  <a
                    href={links.dashboard}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 underline"
                  >
                    Open dashboard
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

