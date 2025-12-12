"use client";

import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";

type RawEntry = any;

type CandidateEntry = {
  id: string;
  candidateName: string;
  title: string;
  execList?: string;
  schedulerUrl?: string;
  createdAt?: string;
};

const STORAGE_KEY = "candidateLog";

function stripExecEmails(execList: string): string {
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
}

function normalizeEntry(e: RawEntry, index: number): CandidateEntry {
  const candidateName =
    e.candidateName || e.name || e.candidate || `Candidate ${index + 1}`;
  const title = e.title || e.role || e.position || "";
  const schedulerUrl =
    e.schedulerUrl || e.schedulerLink || e.scheduler || e.link || undefined;
  const createdAt =
    e.createdAt || e.created || e.time || e.timestamp || undefined;
  const rawExecList = e.execList || e.execs || e.execNotes || "";

  const id = e.id || `${candidateName}-${createdAt || index}`;

  const execList = rawExecList ? stripExecEmails(String(rawExecList)) : "";

  return {
    id: String(id),
    candidateName: String(candidateName),
    title: String(title),
    schedulerUrl,
    createdAt,
    execList,
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
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-end">
          <img src="/intuit-logo.png" alt="Intuit" className="h-9 w-auto" />
        </div>

        <AppNav active="candidates" />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Candidate log</h1>
          <p className="text-sm text-slate-600">
            All candidates captured from the Scheduler (stored in your browser).
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          {entries.length === 0 ? (
            <div className="text-sm text-slate-500">
              No candidates logged yet (or local data was cleared).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left align-top">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Candidate</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Execs</th>
                    <th className="py-2 pr-4">Schedule page</th>
                    <th className="py-2 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">
                        {e.candidateName}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {e.title || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {e.execList ? (
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                            {e.execList}
                          </pre>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {e.schedulerUrl ? (
                          <a
                            href={e.schedulerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 underline text-xs"
                          >
                            Open scheduler
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
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

