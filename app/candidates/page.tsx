"use client";

import { useEffect, useState } from "react";

type RawEntry = any;

type CandidateEntry = {
  id: string;
  candidateName: string;
  title: string;
  schedulerUrl?: string;
  createdAt?: string;
};

const STORAGE_KEY = "candidateLog";

function normalizeEntry(e: RawEntry, index: number): CandidateEntry {
  // Try to tolerate different shapes in localStorage
  const candidateName =
    e.candidateName || e.name || e.candidate || `Candidate ${index + 1}`;
  const title = e.title || e.role || e.position || "";
  const schedulerUrl =
    e.schedulerUrl || e.schedulerLink || e.scheduler || e.link || undefined;
  const createdAt =
    e.createdAt || e.created || e.time || e.timestamp || undefined;

  const id = e.id || `${candidateName}-${createdAt || index}`;

  return {
    id: String(id),
    candidateName: String(candidateName),
    title: String(title),
    schedulerUrl,
    createdAt,
  };
}

function loadFromStorage(): CandidateEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry);
  } catch {
    return [];
  }
}

export default function CandidateLogPage() {
  const [entries, setEntries] = useState<CandidateEntry[]>([]);

  useEffect(() => {
    setEntries(loadFromStorage());
  }, []);

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
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-900 text-slate-50"
            target="_blank"
            rel="noopener noreferrer"
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
            className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-50 text-slate-900"
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
          <h1 className="text-2xl font-semibold">Candidate log</h1>
          <p className="text-sm text-slate-400">
            All candidates captured from the Scheduler (stored in your browser).
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          {entries.length === 0 ? (
            <div className="text-sm text-slate-400">
              No candidates logged yet (or local data was cleared).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Candidate</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Schedule page</th>
                    <th className="py-2 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-800/60 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">
                        {e.candidateName}
                      </td>
                      <td className="py-2 pr-4">{e.title}</td>
                      <td className="py-2 pr-4">
                        {e.schedulerUrl ? (
                          <a
                            href={e.schedulerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 underline text-xs"
                          >
                            Open scheduler
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-400 whitespace-nowrap">
                        {e.createdAt
                          ? new Date(e.createdAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

